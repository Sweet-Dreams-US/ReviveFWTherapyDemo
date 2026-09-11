-- Private durable queue: one conversion for each new, consented website claim.
-- No public table access. RPC callers must present the server sync secret.
create table revive_private.pass_conversion_outbox (
  event_id text primary key,
  lead_id uuid not null unique references revive_private.meta_pass_leads(id),
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','sent','needs_review')),
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  sent_at timestamptz,
  last_error text
);
alter table revive_private.pass_conversion_outbox enable row level security;
revoke all on revive_private.pass_conversion_outbox from public,anon,authenticated;
create index pass_conversion_pending_idx on revive_private.pass_conversion_outbox(next_attempt_at) where status='pending';

create function revive_private.queue_pass_conversion(p_token text,p_email text,p_user_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare l revive_private.meta_pass_leads; eid text;
begin
  if not revive_private.check_sync(p_token) then raise exception 'unauthorized' using errcode='42501'; end if;
  select * into l from revive_private.meta_pass_leads
    where email=lower(trim(p_email)) and meta->>'platform'='website' for update;
  -- Repeated old claims and staff preview sends are not new advertising leads.
  if not found or l.lead_created_at < now()-interval '15 minutes'
    or l.activated_at is not null or l.is_member or l.do_not_contact then return '{}'::jsonb; end if;
  eid := 'website-pass-'||l.id::text;
  insert into revive_private.pass_conversion_outbox(event_id,lead_id,payload)
  values(eid,l.id,jsonb_build_object('event_name','Lead','event_id',eid,
    'event_time',floor(extract(epoch from l.lead_created_at)), 'action_source','website',
    'event_source_url','https://revivefw.com/free-pass','user_data',p_user_data,
    'custom_data',jsonb_build_object('content_name','Free 7 Day Gym and Recovery Pass','content_category','Membership')))
  on conflict(lead_id) do nothing;
  if not (l.meta ? 'ad_measurement') then
    update revive_private.meta_pass_leads set meta=meta||jsonb_build_object(
      'ad_measurement',jsonb_build_object('consent',true,'policy_version','2026-09-11','recorded_at',now(),
      'event_id',eid,'status','pending')), version=version+1 where id=l.id;
  end if;
  return jsonb_build_object('event_id',eid);
end;
$$;

create function revive_private.take_pass_conversions(p_token text,p_event_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if not revive_private.check_sync(p_token) then raise exception 'unauthorized' using errcode='42501'; end if;
  -- Stop before Meta's deduplication window can expire; require staff review.
  with expired as (
    update revive_private.pass_conversion_outbox set status='needs_review',payload='{}'::jsonb
      where status='pending' and (created_at<now()-interval '47 hours' or (attempts>=12 and coalesce(locked_until,now())<=now())) returning lead_id
  ) update revive_private.meta_pass_leads l set meta=jsonb_set(l.meta,'{ad_measurement,status}','"needs_review"'),version=version+1
    from expired e where l.id=e.lead_id;
  with due as (
    select event_id from revive_private.pass_conversion_outbox
    where status='pending' and next_attempt_at<=now() and coalesce(locked_until,now())<=now()
      and (p_event_id is null or event_id=p_event_id)
    order by next_attempt_at limit 20 for update skip locked
  ), leased as (
    update revive_private.pass_conversion_outbox o set attempts=attempts+1,locked_until=now()+interval '2 minutes'
    from due where o.event_id=due.event_id returning o.event_id,o.payload,o.attempts
  ) select coalesce(jsonb_agg(to_jsonb(leased)),'[]'::jsonb) into result from leased;
  return result;
end;
$$;

create function revive_private.finish_pass_conversion(p_token text,p_event_id text,p_attempt integer,p_ok boolean,p_error text)
returns void language plpgsql security definer set search_path='' as $$
declare lid uuid; state text;
begin
  if not revive_private.check_sync(p_token) then raise exception 'unauthorized' using errcode='42501'; end if;
  update revive_private.pass_conversion_outbox set
    status=case when p_ok then 'sent' when attempts>=12 then 'needs_review' else 'pending' end,
    sent_at=case when p_ok then now() else sent_at end,locked_until=null,
    next_attempt_at=now()+make_interval(mins=>least(120,(5*power(2,least(attempts,5)))::integer)),
    last_error=case when p_ok then null else left(p_error,80) end,
    -- Matching payload is no longer needed after acceptance or terminal failure.
    payload=case when p_ok or attempts>=12 then '{}'::jsonb else payload end
    where event_id=p_event_id and status='pending' and attempts=p_attempt returning lead_id,status into lid,state;
  if lid is not null then
    update revive_private.meta_pass_leads set meta=jsonb_set(meta,'{ad_measurement,status}',to_jsonb(state)),version=version+1 where id=lid;
  end if;
end;
$$;

create function public.revive_queue_pass_conversion(p_token text,p_email text,p_user_data jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select revive_private.queue_pass_conversion(p_token,p_email,p_user_data) $$;
create function public.revive_take_pass_conversions(p_token text,p_event_id text)
returns jsonb language sql security invoker set search_path='' as $$ select revive_private.take_pass_conversions(p_token,p_event_id) $$;
create function public.revive_finish_pass_conversion(p_token text,p_event_id text,p_attempt integer,p_ok boolean,p_error text)
returns void language sql security invoker set search_path='' as $$ select revive_private.finish_pass_conversion(p_token,p_event_id,p_attempt,p_ok,p_error) $$;
revoke all on function revive_private.queue_pass_conversion(text,text,jsonb),revive_private.take_pass_conversions(text,text),revive_private.finish_pass_conversion(text,text,integer,boolean,text) from public;
revoke all on function public.revive_queue_pass_conversion(text,text,jsonb),public.revive_take_pass_conversions(text,text),public.revive_finish_pass_conversion(text,text,integer,boolean,text) from public;
grant execute on function revive_private.queue_pass_conversion(text,text,jsonb),revive_private.take_pass_conversions(text,text),revive_private.finish_pass_conversion(text,text,integer,boolean,text) to anon,authenticated;
grant execute on function public.revive_queue_pass_conversion(text,text,jsonb),public.revive_take_pass_conversions(text,text),public.revive_finish_pass_conversion(text,text,integer,boolean,text) to anon,authenticated;
