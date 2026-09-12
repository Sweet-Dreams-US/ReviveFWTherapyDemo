alter table revive_private.meta_pass_leads alter column automation_paused set default false;
alter table revive_private.meta_pass_leads add column marketing_consent_at timestamptz,
  add column marketing_consent_source text, add column email_unsubscribed_at timestamptz;
-- Keep optimistic concurrency, but apply lifecycle flags across the same email
-- so a second claim channel cannot restart a pass or bypass a staff stop.
create or replace function revive_private.update_meta(p_token text,p_id uuid,p_version integer,p_action text,p_value boolean,p_notes text,p_feedback text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare oldrow revive_private.meta_pass_leads; newrow revive_private.meta_pass_leads; addr text; activation timestamptz;
begin
  if not coalesce(public.revive_check_admin(p_token),false) then raise exception 'unauthorized' using errcode='42501'; end if;
  select email into addr from revive_private.meta_pass_leads where id=p_id;
  if addr is null then raise exception 'Lead not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended('revive:lead:'||addr,0));
  select * into oldrow from revive_private.meta_pass_leads where id=p_id for update;
  if p_version is distinct from oldrow.version then raise exception 'Lead changed; refresh before saving' using errcode='40001'; end if;
  if p_action not in('activate','joined','paused','do_not_contact','confirmation_recorded','notes','marketing_consent') then raise exception 'Unknown action'; end if;
  if p_action='marketing_consent' and p_value and length(trim(coalesce(p_notes,'')))<15 then raise exception 'Record the consent evidence'; end if;
  select coalesce(min(activated_at),now()) into activation from revive_private.meta_pass_leads where email=addr;
  update revive_private.meta_pass_leads set
    activated_at=case when p_action='activate' then case when p_value then activation else null end else activated_at end,
    is_member=case when p_action='joined' then p_value else is_member end,
    joined_at=case when p_action='joined' then case when p_value then coalesce(joined_at,now()) else null end else joined_at end,
    automation_paused=case when p_action='paused' then p_value else automation_paused end,
    do_not_contact=case when p_action='do_not_contact' then p_value else do_not_contact end,
    confirmation_recorded_at=case when p_action='confirmation_recorded' then case when p_value then coalesce(confirmation_recorded_at,now()) else null end else confirmation_recorded_at end,
    marketing_consent_at=case when p_action='marketing_consent' then case when p_value then coalesce(marketing_consent_at,now()) else null end else marketing_consent_at end,
    marketing_consent_source=case when p_action='marketing_consent' then case when p_value then 'Staff verified: '||left(p_notes,2000) else null end else marketing_consent_source end,
    notes=case when p_action='notes' then p_notes else notes end,
    feedback=case when p_action='notes' then p_feedback else feedback end,version=version+1
    where email=addr and (p_action<>'notes' or id=p_id);
  select * into newrow from revive_private.meta_pass_leads where id=p_id;
  insert into revive_private.meta_lead_events(lead_id,action,before_state,after_state) values(p_id,p_action,to_jsonb(oldrow),to_jsonb(newrow));
  if p_action='joined' then update public.inquiries set is_member=p_value where lower(email)=addr; end if;
  return to_jsonb(newrow);
end;
$$;
-- Enable the approved process, preserving any explicit staff pause.
update revive_private.meta_pass_leads l set automation_paused=false,version=version+1
where automation_paused and not exists(select 1 from revive_private.meta_lead_events e where e.lead_id=l.id and e.action='paused');

create table revive_private.pass_followup_jobs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references revive_private.meta_pass_leads(id),
  email text not null, stage text not null check(stage in('experience','day5','day7')),
  activated_at timestamptz not null, due_at timestamptz not null, expires_at timestamptz not null,
  status text not null default 'pending' check(status in('pending','sending','sent','suppressed','needs_review')),
  blocked_reason text, payload jsonb, provider_id text, accepted_at timestamptz,
  attempts integer not null default 0, first_attempt_at timestamptz, next_attempt_at timestamptz not null default now(),
  lease uuid, locked_until timestamptz, last_error text, unique(email,stage)
);
create index pass_followup_lead_idx on revive_private.pass_followup_jobs(lead_id);
create index pass_followup_due_idx on revive_private.pass_followup_jobs(due_at,next_attempt_at) where status in('pending','sending');
alter table revive_private.pass_followup_jobs enable row level security;
revoke all on revive_private.pass_followup_jobs from public,anon,authenticated;
create table revive_private.pass_automation_state(id integer primary key check(id=1),last_run_at timestamptz,summary jsonb not null default '{}');
insert into revive_private.pass_automation_state(id) values(1);
alter table revive_private.pass_automation_state enable row level security;
revoke all on revive_private.pass_automation_state from public,anon,authenticated;

create function revive_private.pass_followup_due(p_activation timestamptz,p_stage text) returns timestamptz
language sql immutable set search_path='' as $$
  select case when p_stage='experience' then p_activation+interval '2 hours'
    when p_stage in('day5','day7') then (((p_activation at time zone 'America/Indiana/Indianapolis')::date+
      case when p_stage='day5' then 4 else 6 end)+time '09:00') at time zone 'America/Indiana/Indianapolis' end;
$$;
revoke all on function revive_private.pass_followup_due(timestamptz,text) from public;

-- One pass lifecycle per email, even if the guest used both claim channels.
create function revive_private.plan_followups(p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g record; s text; due timestamptz; expiry timestamptz; reason text; result jsonb;
begin
  if not revive_private.check_sync(p_token) then raise exception 'unauthorized' using errcode='42501'; end if;
  for g in select email,min(activated_at) as activation,
    (array_agg(id order by activated_at nulls last,lead_created_at,id))[1] as lead_id,
    bool_or(is_member) as member,bool_or(do_not_contact) as dnc,bool_or(automation_paused) as paused,
    bool_or(email_unsubscribed_at is not null) as unsubscribed,bool_or(marketing_consent_at is not null) as consent,
    bool_or(visit_feedback_at is not null) as has_feedback
    from revive_private.meta_pass_leads group by email having min(activated_at) is not null
  loop
    foreach s in array array['experience','day5','day7'] loop
      due:=revive_private.pass_followup_due(g.activation,s);
      expiry:=case when s='experience' then g.activation+interval '24 hours'
        when s='day5' then due+interval '15 hours' else revive_private.pass_expires_at(g.activation) end;
      insert into revive_private.pass_followup_jobs(lead_id,email,stage,activated_at,due_at,expires_at)
        values(g.lead_id,g.email,s,g.activation,due,expiry) on conflict(email,stage) do update
        set lead_id=excluded.lead_id,activated_at=excluded.activated_at,due_at=excluded.due_at,expires_at=excluded.expires_at
        where pass_followup_jobs.first_attempt_at is null and pass_followup_jobs.status='pending';
      reason:=case when g.dnc then 'Do not contact' when g.member then 'Already joined' when g.unsubscribed then 'Unsubscribed'
        when s='experience' and g.has_feedback then 'Feedback already received'
        when now()>=expiry then 'Send window ended' when g.paused then 'Paused by staff'
        when s in('day5','day7') and not g.consent then 'Marketing consent required' else null end;
      update revive_private.pass_followup_jobs set blocked_reason=reason,
        status=case when reason in('Do not contact','Already joined','Unsubscribed','Feedback already received','Send window ended') then 'suppressed'
          when first_attempt_at<now()-interval '23 hours' or attempts>=8 then 'needs_review' else 'pending' end
        where email=g.email and stage=s and status in('pending','sending') and coalesce(locked_until,now())<=now();
    end loop;
  end loop;
  select coalesce(jsonb_agg(to_jsonb(j)),'[]') into result from (
    select id,lead_id,email,stage,activated_at from revive_private.pass_followup_jobs
      where status='pending' and blocked_reason is null and due_at<=now() and expires_at>now()
      and next_attempt_at<=now() and coalesce(locked_until,now())<=now() order by due_at limit 6
  ) j;
  return result;
end;
$$;

create function revive_private.prepare_followup(p_token text,p_id uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j revive_private.pass_followup_jobs; g record; v_lease uuid;
begin
  if not revive_private.check_sync(p_token) then raise exception 'unauthorized' using errcode='42501'; end if;
  select * into j from revive_private.pass_followup_jobs where id=p_id for update;
  if not found then return jsonb_build_object('status','missing'); end if;
  if j.status not in('pending','sending') then return jsonb_build_object('status',j.status); end if;
  if j.locked_until>now() or j.next_attempt_at>now() or j.due_at>now() then return jsonb_build_object('status','waiting'); end if;
  select min(activated_at) as activation,bool_or(is_member or do_not_contact or email_unsubscribed_at is not null) as suppressed,
    bool_or(automation_paused) as paused,bool_or(marketing_consent_at is not null) as consent,
    bool_or(visit_feedback_at is not null) as has_feedback into g from revive_private.meta_pass_leads where email=j.email;
  if g.activation is distinct from j.activated_at or g.suppressed or j.expires_at<=now() or
    (j.stage='experience' and g.has_feedback) or not exists(select 1 from revive_private.meta_pass_leads where id=j.lead_id and email=j.email) then
    update revive_private.pass_followup_jobs set status='suppressed',blocked_reason='Pass state changed or send window ended' where id=j.id;
    return jsonb_build_object('status','suppressed');
  end if;
  if g.paused or (j.stage in('day5','day7') and not g.consent) then return jsonb_build_object('status','blocked'); end if;
  if j.first_attempt_at<now()-interval '23 hours' or j.attempts>=8 then
    update revive_private.pass_followup_jobs set status='needs_review' where id=j.id;
    return jsonb_build_object('status','needs_review');
  end if;
  v_lease:=gen_random_uuid();
  update revive_private.pass_followup_jobs set status='sending',lease=v_lease,locked_until=now()+interval '2 minutes',
    first_attempt_at=coalesce(first_attempt_at,now()),attempts=attempts+1,
    payload=coalesce(payload,jsonb_set(p_payload,'{to}',jsonb_build_array(j.email))) where id=j.id returning * into j;
  return jsonb_build_object('status','ready','lease',v_lease,'payload',j.payload);
end;
$$;
create function revive_private.finish_followup(p_token text,p_id uuid,p_lease uuid,p_provider_id text,p_error text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not revive_private.check_sync(p_token) then raise exception 'unauthorized' using errcode='42501'; end if;
  update revive_private.pass_followup_jobs set status=case when p_provider_id is not null then 'sent' when attempts>=8 then 'needs_review' else 'pending' end,
    provider_id=coalesce(p_provider_id,provider_id),accepted_at=case when p_provider_id is not null then now() else accepted_at end,
    last_error=left(p_error,200),locked_until=null,lease=null,next_attempt_at=now()+make_interval(mins=>least(120,5*attempts))
    where id=p_id and lease=p_lease and status='sending';
end;
$$;
create function revive_private.followup_state(p_token text,p_ids uuid[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare jobs jsonb; run jsonb;
begin
  if not coalesce(public.revive_check_admin(p_token),false) then raise exception 'unauthorized' using errcode='42501'; end if;
  if cardinality(p_ids)>100 then raise exception 'Too many leads'; end if;
  select coalesce(jsonb_agg(to_jsonb(j)-'payload'-'lease'),'[]') into jobs from revive_private.pass_followup_jobs j
    where email in(select email from revive_private.meta_pass_leads where id=any(p_ids));
  select to_jsonb(s) into run from revive_private.pass_automation_state s where id=1;
  return jsonb_build_object('jobs',jobs,'run',run);
end;
$$;
create function revive_private.record_followup_run(p_token text,p_summary jsonb) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not revive_private.check_sync(p_token) then raise exception 'unauthorized' using errcode='42501'; end if;
  update revive_private.pass_automation_state set last_run_at=now(),summary=p_summary where id=1;
end;
$$;
create function revive_private.unsubscribe_pass(p_token text,p_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare addr text;
begin
  if not revive_private.check_sync(p_token) then raise exception 'unauthorized' using errcode='42501'; end if;
  select email into addr from revive_private.meta_pass_leads where id=p_id;
  if addr is null then return false; end if;
  update revive_private.meta_pass_leads set email_unsubscribed_at=coalesce(email_unsubscribed_at,now()),version=version+1 where email=addr;
  update revive_private.pass_followup_jobs set status='suppressed',blocked_reason='Unsubscribed' where email=addr and status='pending';
  return true;
end;
$$;
create function revive_private.pass_marketing_consent(p_token text,p_email text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not revive_private.check_sync(p_token) then raise exception 'unauthorized' using errcode='42501'; end if;
  -- Only a fresh, CAPTCHA verified website opt-in. It never reverses an unsubscribe.
  if exists(select 1 from revive_private.meta_pass_leads where email=p_email and email_unsubscribed_at is not null) then return; end if;
  update revive_private.meta_pass_leads set marketing_consent_at=now(),
    marketing_consent_source='Website optional checkbox: Email me membership offers from REVIVE, including the Day 5 and Day 7 joining bonus. I can unsubscribe anytime. Version 2026-09-12',version=version+1
    where email=p_email and meta->>'platform'='website' and lead_created_at>now()-interval '15 minutes' and not do_not_contact;
end;
$$;

create function public.revive_plan_followups(p_token text) returns jsonb language sql security invoker set search_path='' as $$ select revive_private.plan_followups(p_token) $$;
create function public.revive_prepare_followup(p_token text,p_id uuid,p_payload jsonb) returns jsonb language sql security invoker set search_path='' as $$ select revive_private.prepare_followup(p_token,p_id,p_payload) $$;
create function public.revive_finish_followup(p_token text,p_id uuid,p_lease uuid,p_provider_id text,p_error text) returns void language sql security invoker set search_path='' as $$ select revive_private.finish_followup(p_token,p_id,p_lease,p_provider_id,p_error) $$;
create function public.revive_followup_state(p_token text,p_ids uuid[]) returns jsonb language sql security invoker set search_path='' as $$ select revive_private.followup_state(p_token,p_ids) $$;
create function public.revive_record_followup_run(p_token text,p_summary jsonb) returns void language sql security invoker set search_path='' as $$ select revive_private.record_followup_run(p_token,p_summary) $$;
create function public.revive_unsubscribe_pass(p_token text,p_id uuid) returns boolean language sql security invoker set search_path='' as $$ select revive_private.unsubscribe_pass(p_token,p_id) $$;
create function public.revive_pass_marketing_consent(p_token text,p_email text) returns void language sql security invoker set search_path='' as $$ select revive_private.pass_marketing_consent(p_token,p_email) $$;
revoke all on function revive_private.plan_followups(text),revive_private.prepare_followup(text,uuid,jsonb),revive_private.finish_followup(text,uuid,uuid,text,text),revive_private.followup_state(text,uuid[]),revive_private.record_followup_run(text,jsonb),revive_private.unsubscribe_pass(text,uuid),revive_private.pass_marketing_consent(text,text) from public;
revoke all on function public.revive_plan_followups(text),public.revive_prepare_followup(text,uuid,jsonb),public.revive_finish_followup(text,uuid,uuid,text,text),public.revive_followup_state(text,uuid[]),public.revive_record_followup_run(text,jsonb),public.revive_unsubscribe_pass(text,uuid),public.revive_pass_marketing_consent(text,text) from public;
grant execute on function revive_private.plan_followups(text),revive_private.prepare_followup(text,uuid,jsonb),revive_private.finish_followup(text,uuid,uuid,text,text),revive_private.followup_state(text,uuid[]),revive_private.record_followup_run(text,jsonb),revive_private.unsubscribe_pass(text,uuid),revive_private.pass_marketing_consent(text,text) to anon,authenticated;
grant execute on function public.revive_plan_followups(text),public.revive_prepare_followup(text,uuid,jsonb),public.revive_finish_followup(text,uuid,uuid,text,text),public.revive_followup_state(text,uuid[]),public.revive_record_followup_run(text,jsonb),public.revive_unsubscribe_pass(text,uuid),public.revive_pass_marketing_consent(text,text) to anon,authenticated;
-- Preserve the current calendar and filter implementation while declaring the
-- running email worker. Individual offers still require recorded consent.
do $$ begin
  execute replace(pg_get_functiondef('revive_private.list_meta(text,integer,text,text)'::regprocedure),'''emails_enabled'',false','''emails_enabled'',true');
end $$;
