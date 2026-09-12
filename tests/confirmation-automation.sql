begin;
do $$
declare token text; a uuid; b uuid; r jsonb;
begin
  select value into token from public.app_secrets where key='meta_sync_secret';
  insert into revive_private.meta_pass_leads(meta_lead_id,full_name,email,lead_created_at,source_row,meta)
    values('synthetic-confirmation-meta','Synthetic','synthetic-confirmation@example.com',now()-interval '2 days',0,'{"platform":"fb"}') returning id into a;
  perform public.revive_claim_website_pass(token,'Synthetic','synthetic-confirmation@example.com','');
  select id into b from revive_private.meta_pass_leads where email='synthetic-confirmation@example.com' and id<>a;
  assert public.revive_pending_confirmations(token) ? 'synthetic-confirmation@example.com';
  r:=public.revive_prepare_pass_email(token,'synthetic-confirmation@example.com','{"to":["wrong@example.com"],"subject":"test"}');
  assert r->>'status'='ready'; assert r->'payload'->'to'->>0='synthetic-confirmation@example.com';
  assert (public.revive_prepare_pass_email(token,'synthetic-confirmation@example.com','{}'))->>'status'='sending';
  perform public.revive_finish_pass_email(token,(r->>'lead_id')::uuid,null);
  update revive_private.pass_email_outbox set next_attempt_at=now() where lead_id=(r->>'lead_id')::uuid;
  assert (public.revive_prepare_pass_email(token,'synthetic-confirmation@example.com','{"subject":"changed"}'))->'payload'->>'subject'='test';
  perform public.revive_finish_pass_email(token,(r->>'lead_id')::uuid,'synthetic-provider');
  assert (select count(*) from revive_private.meta_pass_leads where id in(a,b) and pass_email_status='sent')=2;
  assert (public.revive_prepare_pass_email(token,'synthetic-confirmation@example.com','{}'))->>'status'='sent';
  assert not(public.revive_pending_confirmations(token) ? 'synthetic-confirmation@example.com');
  begin perform public.revive_pending_confirmations('bad');raise exception 'Unauthorized candidates';exception when insufficient_privilege then null;end;
end $$;
rollback;
select 'PASS: Meta confirmation, cross-channel deduplication, frozen retry, shared receipt, authorization' as result;
