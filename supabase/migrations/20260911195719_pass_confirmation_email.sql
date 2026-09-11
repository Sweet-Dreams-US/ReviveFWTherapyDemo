alter table revive_private.meta_pass_leads
  add column pass_email_status text not null default 'not_sent',
  add column pass_email_sent_at timestamptz,
  add column pass_email_id text;
create table revive_private.pass_email_outbox (
  lead_id uuid primary key references revive_private.meta_pass_leads(id),
  payload jsonb not null,
  first_attempt_at timestamptz not null default now(),
  locked_until timestamptz
);
alter table revive_private.pass_email_outbox enable row level security;
revoke all on revive_private.pass_email_outbox from public,anon,authenticated;

create function revive_private.prepare_pass_email(p_token text,p_email text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare l revive_private.meta_pass_leads; o revive_private.pass_email_outbox;
begin
  if not revive_private.check_sync(p_token) then raise exception 'unauthorized' using errcode='42501'; end if;
  select * into l from revive_private.meta_pass_leads where email=lower(trim(p_email)) and meta->>'platform'='website' for update;
  if not found then raise exception 'Claim not found'; end if;
  if l.pass_email_status='sent' then return jsonb_build_object('status','sent'); end if;
  if l.do_not_contact or l.is_member or l.activated_at is not null then return jsonb_build_object('status','suppressed'); end if;
  insert into revive_private.pass_email_outbox(lead_id,payload)
    values(l.id,jsonb_set(p_payload,'{to}',jsonb_build_array(l.email))) on conflict do nothing;
  select * into o from revive_private.pass_email_outbox where lead_id=l.id;
  if o.first_attempt_at < now()-interval '23 hours' then
    update revive_private.meta_pass_leads set pass_email_status='needs_review',version=version+1 where id=l.id;
    return jsonb_build_object('status','needs_review');
  end if;
  if o.locked_until>now() then return jsonb_build_object('status','sending'); end if;
  update revive_private.pass_email_outbox set locked_until=now()+interval '1 minute' where lead_id=l.id;
  update revive_private.meta_pass_leads set pass_email_status='sending',version=version+1 where id=l.id;
  return jsonb_build_object('status','ready','lead_id',l.id,'payload',o.payload);
end;
$$;
create function revive_private.finish_pass_email(p_token text,p_id uuid,p_provider_id text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not revive_private.check_sync(p_token) then raise exception 'unauthorized' using errcode='42501'; end if;
  update revive_private.meta_pass_leads set
    pass_email_status=case when p_provider_id is not null then 'sent' else 'needs_review' end,
    pass_email_id=coalesce(p_provider_id,pass_email_id),
    pass_email_sent_at=case when p_provider_id is not null then coalesce(pass_email_sent_at,now()) else pass_email_sent_at end,
    version=version+1
  where id=p_id and pass_email_status<>'sent';
  update revive_private.pass_email_outbox set locked_until=null where lead_id=p_id;
end;
$$;
create function public.revive_prepare_pass_email(p_token text,p_email text,p_payload jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select revive_private.prepare_pass_email(p_token,p_email,p_payload) $$;
create function public.revive_finish_pass_email(p_token text,p_id uuid,p_provider_id text)
returns void language sql security invoker set search_path='' as $$ select revive_private.finish_pass_email(p_token,p_id,p_provider_id) $$;
revoke all on function revive_private.prepare_pass_email(text,text,jsonb),revive_private.finish_pass_email(text,uuid,text) from public;
revoke all on function public.revive_prepare_pass_email(text,text,jsonb),public.revive_finish_pass_email(text,uuid,text) from public;
grant execute on function revive_private.prepare_pass_email(text,text,jsonb),revive_private.finish_pass_email(text,uuid,text) to anon,authenticated;
grant execute on function public.revive_prepare_pass_email(text,text,jsonb),public.revive_finish_pass_email(text,uuid,text) to anon,authenticated;
