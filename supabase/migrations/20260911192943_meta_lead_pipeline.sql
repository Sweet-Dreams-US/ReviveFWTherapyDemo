-- Separate from public inquiry inserts: only authenticated RPCs may create or
-- change Meta leads. Uses the existing REVIVE admin password check, not Supabase Auth.
create schema if not exists revive_private;
revoke all on schema revive_private from public;
grant usage on schema revive_private to anon, authenticated;

create table revive_private.meta_pass_leads (
  id uuid primary key default gen_random_uuid(),
  meta_lead_id text not null unique check (length(meta_lead_id) between 1 and 100),
  full_name text not null check (length(full_name) between 1 and 240),
  email text not null check (length(email) <= 200 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text,
  lead_created_at timestamptz not null,
  imported_at timestamptz not null default now(),
  source_row integer not null,
  meta jsonb not null default '{}',
  fitness_routine text,
  activated_at timestamptz,
  is_member boolean not null default false,
  joined_at timestamptz,
  automation_paused boolean not null default true,
  do_not_contact boolean not null default false,
  confirmation_recorded_at timestamptz,
  feedback text not null default '' check (length(feedback) <= 2000),
  notes text not null default '' check (length(notes) <= 4000),
  version integer not null default 1
);
create index meta_pass_leads_created_idx on revive_private.meta_pass_leads (lead_created_at desc, id);
create index meta_pass_leads_email_idx on revive_private.meta_pass_leads (email);
alter table revive_private.meta_pass_leads enable row level security;

create table revive_private.meta_sync_state (
  id integer primary key check (id = 1),
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  locked_until timestamptz,
  last_error text,
  summary jsonb not null default '{}'
);
alter table revive_private.meta_sync_state enable row level security;
insert into revive_private.meta_sync_state (id) values (1);

create table revive_private.meta_lead_events (
  id bigint generated always as identity primary key,
  lead_id uuid not null references revive_private.meta_pass_leads(id),
  occurred_at timestamptz not null default now(),
  action text not null,
  before_state jsonb not null,
  after_state jsonb not null
);
create index meta_lead_events_lead_idx on revive_private.meta_lead_events (lead_id, occurred_at desc);
alter table revive_private.meta_lead_events enable row level security;
revoke all on all tables in schema revive_private from public, anon, authenticated;

create function revive_private.check_sync(p_token text) returns boolean
language sql security definer set search_path = '' as $$
  select coalesce(length(p_token) >= 32 and exists (
    select 1 from public.app_secrets where key = 'meta_sync_secret' and value = p_token
  ), false);
$$;

create function revive_private.sync_lock(p_token text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare acquired boolean;
begin
  if not revive_private.check_sync(p_token) then raise exception 'unauthorized' using errcode='42501'; end if;
  update revive_private.meta_sync_state set locked_until=now()+interval '2 minutes', last_attempt_at=now()
  where id=1 and (locked_until is null or locked_until < now()) returning true into acquired;
  return coalesce(acquired, false);
end;
$$;

create function revive_private.import_meta(p_token text, p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r jsonb; existing uuid; imported integer:=0; updated integer:=0;
begin
  if not revive_private.check_sync(p_token) then raise exception 'unauthorized' using errcode='42501'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 100 then raise exception 'Invalid import batch'; end if;
  for r in select value from jsonb_array_elements(p_rows) loop
    select id into existing from revive_private.meta_pass_leads where meta_lead_id=r->>'meta_lead_id';
    insert into revive_private.meta_pass_leads as dest
      (meta_lead_id, full_name, email, phone, lead_created_at, source_row, meta, fitness_routine, is_member)
    values (r->>'meta_lead_id', r->>'full_name', lower(r->>'email'), left(r->>'phone',40),
      (r->>'lead_created_at')::timestamptz, (r->>'source_row')::integer, r->'meta', left(r->>'fitness_routine',2000),
      exists(select 1 from public.inquiries where lower(email)=lower(r->>'email') and is_member=true))
    on conflict (meta_lead_id) do update set
      full_name=excluded.full_name, email=excluded.email, phone=excluded.phone,
      lead_created_at=excluded.lead_created_at, source_row=excluded.source_row,
      meta=excluded.meta, fitness_routine=excluded.fitness_routine, version=dest.version+1
    where (dest.full_name,dest.email,dest.phone,dest.lead_created_at,dest.source_row,dest.meta,dest.fitness_routine)
      is distinct from (excluded.full_name,excluded.email,excluded.phone,excluded.lead_created_at,excluded.source_row,excluded.meta,excluded.fitness_routine);
    if existing is null then imported:=imported+1; else updated:=updated+1; end if;
  end loop;
  return jsonb_build_object('imported',imported,'updated',updated);
end;
$$;

create function revive_private.sync_finish(p_token text, p_summary jsonb, p_error text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not revive_private.check_sync(p_token) then raise exception 'unauthorized' using errcode='42501'; end if;
  update revive_private.meta_sync_state set locked_until=null, last_error=left(p_error,500),
    last_success_at=case when p_error is null then now() else last_success_at end,
    summary=case when p_error is null then p_summary else summary end where id=1;
end;
$$;

create function revive_private.list_meta(p_token text, p_offset integer, p_query text, p_filter text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb; counts jsonb; total integer; sync jsonb;
begin
  if not coalesce(public.revive_check_admin(p_token),false) then raise exception 'unauthorized' using errcode='42501'; end if;
  select jsonb_build_object('total',count(*), 'unactivated',count(*) filter(where activated_at is null and not is_member),
    'active',count(*) filter(where activated_at is not null and activated_at+interval '7 days'>now() and not is_member),
    'joined',count(*) filter(where is_member)) into counts from revive_private.meta_pass_leads;
  with matching as (
    select * from revive_private.meta_pass_leads l
    where (coalesce(p_query,'')='' or strpos(lower(l.full_name || ' ' || l.email || ' ' || coalesce(l.phone,'')),lower(left(p_query,200)))>0)
    and case p_filter
      when 'unactivated' then l.activated_at is null and not l.is_member
      when 'active' then l.activated_at is not null and l.activated_at+interval '7 days'>now() and not l.is_member
      when 'expired' then l.activated_at+interval '7 days'<=now() and not l.is_member
      when 'joined' then l.is_member
      when 'paused' then l.automation_paused
      when 'do_not_contact' then l.do_not_contact
      else true end
  ), page as (select * from matching order by lead_created_at desc,id limit 100 offset greatest(p_offset,0))
  select (select count(*) from matching), coalesce(jsonb_agg(to_jsonb(page) order by lead_created_at desc,id),'[]') into total,result from page;
  select to_jsonb(s)-'locked_until' into sync from revive_private.meta_sync_state s where id=1;
  return jsonb_build_object('ok',true,'leads',result,'total',total,'stats',counts,'sync',sync,'emails_enabled',false);
end;
$$;

create function revive_private.update_meta(p_token text,p_id uuid,p_version integer,p_action text,p_value boolean,p_notes text,p_feedback text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare oldrow revive_private.meta_pass_leads; newrow revive_private.meta_pass_leads;
begin
  if not coalesce(public.revive_check_admin(p_token),false) then raise exception 'unauthorized' using errcode='42501'; end if;
  select * into oldrow from revive_private.meta_pass_leads where id=p_id for update;
  if not found then raise exception 'Lead not found'; end if;
  if p_version is distinct from oldrow.version then raise exception 'Lead changed; refresh before saving' using errcode='40001'; end if;
  if p_action not in ('activate','joined','paused','do_not_contact','confirmation_recorded','notes') then raise exception 'Unknown action'; end if;
  update revive_private.meta_pass_leads set
    activated_at=case when p_action='activate' then case when p_value then coalesce(activated_at,now()) else null end else activated_at end,
    is_member=case when p_action='joined' then p_value else is_member end,
    joined_at=case when p_action='joined' then case when p_value then coalesce(joined_at,now()) else null end else joined_at end,
    automation_paused=case when p_action='paused' then p_value else automation_paused end,
    do_not_contact=case when p_action='do_not_contact' then p_value else do_not_contact end,
    confirmation_recorded_at=case when p_action='confirmation_recorded' then case when p_value then coalesce(confirmation_recorded_at,now()) else null end else confirmation_recorded_at end,
    notes=case when p_action='notes' then p_notes else notes end,
    feedback=case when p_action='notes' then p_feedback else feedback end,
    version=version+1
  where id=p_id returning * into newrow;
  insert into revive_private.meta_lead_events(lead_id,action,before_state,after_state)
    values(p_id,p_action,to_jsonb(oldrow),to_jsonb(newrow));
  if p_action='joined' then
    update public.inquiries set is_member=p_value where lower(email)=newrow.email;
  end if;
  return to_jsonb(newrow);
end;
$$;

-- PostgREST exposes only invoker wrappers; privileged implementations live in a
-- non-exposed schema and validate the scoped sync secret or existing admin token.
create function public.revive_meta_sync_lock(p_token text) returns boolean language sql security invoker set search_path='' as $$ select revive_private.sync_lock(p_token) $$;
create function public.revive_meta_import(p_token text,p_rows jsonb) returns jsonb language sql security invoker set search_path='' as $$ select revive_private.import_meta(p_token,p_rows) $$;
create function public.revive_meta_sync_finish(p_token text,p_summary jsonb,p_error text) returns void language sql security invoker set search_path='' as $$ select revive_private.sync_finish(p_token,p_summary,p_error) $$;
create function public.revive_meta_list(p_token text,p_offset integer default 0,p_query text default '',p_filter text default 'all') returns jsonb language sql security invoker set search_path='' as $$ select revive_private.list_meta(p_token,p_offset,p_query,p_filter) $$;
create function public.revive_meta_update(p_token text,p_id uuid,p_version integer,p_action text,p_value boolean,p_notes text,p_feedback text) returns jsonb language sql security invoker set search_path='' as $$ select revive_private.update_meta(p_token,p_id,p_version,p_action,p_value,p_notes,p_feedback) $$;

revoke all on all functions in schema revive_private from public;
grant execute on function revive_private.sync_lock(text), revive_private.import_meta(text,jsonb), revive_private.sync_finish(text,jsonb,text), revive_private.list_meta(text,integer,text,text), revive_private.update_meta(text,uuid,integer,text,boolean,text,text) to anon,authenticated;
revoke all on function public.revive_meta_sync_lock(text), public.revive_meta_import(text,jsonb), public.revive_meta_sync_finish(text,jsonb,text), public.revive_meta_list(text,integer,text,text), public.revive_meta_update(text,uuid,integer,text,boolean,text,text) from public;
grant execute on function public.revive_meta_sync_lock(text), public.revive_meta_import(text,jsonb), public.revive_meta_sync_finish(text,jsonb,text), public.revive_meta_list(text,integer,text,text), public.revive_meta_update(text,uuid,integer,text,boolean,text,text) to anon,authenticated;
