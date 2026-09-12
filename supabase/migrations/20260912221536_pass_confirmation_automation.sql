-- Confirmations are one per email across website and Meta claims. Keep existing
-- Resend IDs and frozen payloads so recovery cannot send a second confirmation.
alter table revive_private.pass_email_outbox add column attempts integer not null default 0,
  add column next_attempt_at timestamptz not null default now(), add column last_error text;

create or replace function revive_private.prepare_pass_email(p_token text,p_email text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare l revive_private.meta_pass_leads; prior revive_private.meta_pass_leads; o revive_private.pass_email_outbox;
begin
  if not revive_private.check_sync(p_token) then raise exception 'unauthorized' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('revive:confirmation:'||lower(trim(p_email)),0));
  -- An existing outbox is canonical for retries even if another channel arrives later.
  select x.* into l from revive_private.meta_pass_leads x left join revive_private.pass_email_outbox q on q.lead_id=x.id
    where x.email=lower(trim(p_email)) order by q.first_attempt_at nulls last,x.lead_created_at,x.id limit 1 for update of x;
  if not found then raise exception 'Claim not found'; end if;
  select * into prior from revive_private.meta_pass_leads where email=l.email and pass_email_status='sent' order by pass_email_sent_at limit 1;
  if found then
    update revive_private.meta_pass_leads set pass_email_status='sent',pass_email_id=prior.pass_email_id,
      pass_email_sent_at=prior.pass_email_sent_at,version=version+1 where email=l.email and pass_email_status<>'sent';
    return jsonb_build_object('status','sent');
  end if;
  if exists(select 1 from revive_private.meta_pass_leads where email=l.email and
    (do_not_contact or is_member or confirmation_recorded_at is not null or
    (activated_at is not null and revive_private.pass_expires_at(activated_at)<=now()))) then
    return jsonb_build_object('status','suppressed');
  end if;
  insert into revive_private.pass_email_outbox(lead_id,payload)
    values(l.id,jsonb_set(p_payload,'{to}',jsonb_build_array(l.email))) on conflict do nothing;
  select * into o from revive_private.pass_email_outbox where lead_id=l.id;
  if o.first_attempt_at<now()-interval '23 hours' or o.attempts>=8 then
    update revive_private.meta_pass_leads set pass_email_status='needs_review',version=version+1 where email=l.email and pass_email_status<>'needs_review';
    return jsonb_build_object('status','needs_review');
  end if;
  if o.locked_until>now() or o.next_attempt_at>now() then return jsonb_build_object('status','sending'); end if;
  update revive_private.pass_email_outbox set locked_until=now()+interval '2 minutes',attempts=attempts+1 where lead_id=l.id;
  update revive_private.meta_pass_leads set pass_email_status='sending',version=version+1 where email=l.email;
  return jsonb_build_object('status','ready','lead_id',l.id,'payload',o.payload);
end;
$$;
create or replace function revive_private.finish_pass_email(p_token text,p_id uuid,p_provider_id text)
returns void language plpgsql security definer set search_path='' as $$
declare addr text;
begin
  if not revive_private.check_sync(p_token) then raise exception 'unauthorized' using errcode='42501'; end if;
  select email into addr from revive_private.meta_pass_leads where id=p_id;
  perform pg_advisory_xact_lock(hashtextextended('revive:confirmation:'||addr,0));
  update revive_private.meta_pass_leads set
    pass_email_status=case when p_provider_id is not null then 'sent' else 'needs_review' end,
    pass_email_id=coalesce(p_provider_id,pass_email_id),
    pass_email_sent_at=case when p_provider_id is not null then coalesce(pass_email_sent_at,now()) else pass_email_sent_at end,
    version=version+1 where email=addr and pass_email_status<>'sent';
  update revive_private.pass_email_outbox set locked_until=null,
    next_attempt_at=now()+make_interval(mins=>least(120,5*greatest(attempts,1))),
    last_error=case when p_provider_id is null then 'Provider acceptance uncertain; retry uses original idempotency key' else null end
    where lead_id=p_id;
end;
$$;
create function revive_private.pending_confirmations(p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if not revive_private.check_sync(p_token) then raise exception 'unauthorized' using errcode='42501'; end if;
  -- Reconcile already sent cross-channel claims without another provider request.
  update revive_private.meta_pass_leads l set pass_email_status='sent',pass_email_id=p.pass_email_id,
    pass_email_sent_at=p.pass_email_sent_at,version=l.version+1
    from revive_private.meta_pass_leads p where l.email=p.email and p.pass_email_status='sent' and l.pass_email_status<>'sent';
  select coalesce(jsonb_agg(q.email),'[]') into result from (
    select l.email,min(l.lead_created_at) as created from revive_private.meta_pass_leads l
    where l.lead_created_at>=now()-interval '14 days'
      and not exists(select 1 from revive_private.meta_pass_leads p where p.email=l.email and
        (p.pass_email_status='sent' or p.do_not_contact or p.is_member or p.confirmation_recorded_at is not null or
        (p.activated_at is not null and revive_private.pass_expires_at(p.activated_at)<=now())))
      and not exists(select 1 from revive_private.pass_email_outbox o join revive_private.meta_pass_leads p on p.id=o.lead_id
        where p.email=l.email and (o.first_attempt_at<now()-interval '23 hours' or o.attempts>=8 or o.locked_until>now() or o.next_attempt_at>now()))
    group by l.email order by created limit 10
  ) q;
  return result;
end;
$$;
create function public.revive_pending_confirmations(p_token text) returns jsonb
language sql security invoker set search_path='' as $$ select revive_private.pending_confirmations(p_token) $$;
revoke all on function revive_private.pending_confirmations(text),public.revive_pending_confirmations(text) from public;
grant execute on function revive_private.pending_confirmations(text),public.revive_pending_confirmations(text) to anon,authenticated;
