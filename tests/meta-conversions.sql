begin;
do $$
declare token text; email text:='synthetic-meta-conversion@example.com'; a jsonb; b jsonb; batch jsonb; eid text;
begin
  select value into token from public.app_secrets where key='meta_sync_secret';
  perform public.revive_claim_website_pass(token,'Synthetic conversion',email,'');
  a:=public.revive_queue_pass_conversion(token,email,'{"em":["synthetic-hash"]}'); eid:=a->>'event_id';
  assert eid is not null;
  b:=public.revive_queue_pass_conversion(token,email,'{"em":["different"]}'); assert a=b;
  assert (select count(*) from revive_private.pass_conversion_outbox where event_id=eid)=1;
  batch:=public.revive_take_pass_conversions(token,eid);
  assert jsonb_array_length(batch)=1; assert batch->0->'payload'->>'event_id'=eid;
  assert batch->0->'payload'->'user_data'->'em'->>0='synthetic-hash';
  assert public.revive_take_pass_conversions(token,eid)='[]'::jsonb;
  perform public.revive_finish_pass_conversion(token,eid,1,false,'network');
  update revive_private.pass_conversion_outbox set next_attempt_at=now() where event_id=eid;
  batch:=public.revive_take_pass_conversions(token,eid); assert batch->0->>'attempts'='2';
  perform public.revive_finish_pass_conversion(token,eid,1,true,null);
  assert (select status from revive_private.pass_conversion_outbox where event_id=eid)='pending';
  perform public.revive_finish_pass_conversion(token,eid,2,true,null);
  assert (select status from revive_private.pass_conversion_outbox where event_id=eid)='sent';
  assert (select payload from revive_private.pass_conversion_outbox where event_id=eid)='{}'::jsonb;
  assert public.revive_take_pass_conversions(token,eid)='[]'::jsonb;
  assert (select meta->'ad_measurement'->>'status' from revive_private.meta_pass_leads where id=(select lead_id from revive_private.pass_conversion_outbox where event_id=eid))='sent';
  update revive_private.meta_pass_leads set lead_created_at=now()-interval '1 day' where id=(select lead_id from revive_private.pass_conversion_outbox where event_id=eid);
  assert public.revive_queue_pass_conversion(token,email,'{}')='{}'::jsonb;
  begin perform public.revive_queue_pass_conversion('wrong',email,'{}');raise exception 'Unauthorized queue accepted';exception when insufficient_privilege then null;end;
  begin perform public.revive_take_pass_conversions('wrong',null);raise exception 'Unauthorized take accepted';exception when insufficient_privilege then null;end;
  begin perform public.revive_finish_pass_conversion('wrong',eid,2,true,null);raise exception 'Unauthorized finish accepted';exception when insufficient_privilege then null;end;
end $$;
set local role anon;
do $$ begin
  begin perform 1 from revive_private.pass_conversion_outbox;raise exception 'Public queue readable';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
select 'PASS: stable conversion ID, lease, retry, stale worker rejection, PII cleanup, old claim suppression, RPC and table security' as result;
