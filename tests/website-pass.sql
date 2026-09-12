begin;
do $$
declare token text; l revive_private.meta_pass_leads; p jsonb;
begin
  select value into token from public.app_secrets where key='meta_sync_secret';
  perform public.revive_claim_website_pass(token,'Synthetic Claim','synthetic-website-test@example.com','');
  select * into l from revive_private.meta_pass_leads where email='synthetic-website-test@example.com';
  if l.activated_at is not null or l.automation_paused then raise exception 'Claim activated pass or default worker is paused'; end if;
  perform public.revive_claim_website_pass(token,'Different Name','SYNTHETIC-WEBSITE-TEST@example.com','123');
  if (select count(*) from revive_private.meta_pass_leads where email=l.email)<>1 then raise exception 'Duplicate claim'; end if;
  if (select full_name from revive_private.meta_pass_leads where id=l.id)<>'Synthetic Claim' then raise exception 'Repeat changed identity'; end if;
  p:=public.revive_prepare_pass_email(token,l.email,'{"to":["wrong@example.com"],"subject":"test"}');
  if p->>'status'<>'ready' or p->'payload'->'to'->>0<>l.email then raise exception 'Email not ready or recipient mismatch'; end if;
  p:=public.revive_prepare_pass_email(token,l.email,'{}');
  if p->>'status'<>'sending' then raise exception 'Concurrent email allowed'; end if;
  perform public.revive_finish_pass_email(token,l.id,'synthetic-provider-id');
  p:=public.revive_prepare_pass_email(token,l.email,'{}');
  if p->>'status'<>'sent' then raise exception 'Sent email queued again'; end if;
  if (select activated_at is not null from revive_private.meta_pass_leads where id=l.id) then raise exception 'Email started trial'; end if;
  begin perform public.revive_claim_website_pass('invalid','Bad','bad@example.com','');raise exception 'Unauthorized claim allowed';exception when insufficient_privilege then null;end;
end $$;
set local role anon;
do $$ begin
  begin perform 1 from revive_private.pass_email_outbox;raise exception 'Public outbox read allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
select 'PASS: claim deduplication, identity preservation, email lease, sent flag, no activation, private outbox' as result;
