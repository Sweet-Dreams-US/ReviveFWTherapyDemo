-- Transactional production-safe checks: all synthetic rows and changes roll back.
begin;
do $$
declare token text; admin_token text; rowid uuid; l jsonb; imported jsonb; start_time timestamptz;
begin
  select value into token from public.app_secrets where key='meta_sync_secret';
  select value into admin_token from public.app_secrets where key='admin_secret';
  if not public.revive_meta_sync_lock(token) then raise exception 'Sync lock unavailable'; end if;
  if public.revive_meta_sync_lock(token) then raise exception 'Overlapping sync was allowed'; end if;
  perform public.revive_meta_sync_finish(token,'{}',null);
  begin
    perform public.revive_meta_list('invalid',0,'','all');
    raise exception 'Expected unauthorized list';
  exception when insufficient_privilege then null; end;
  begin
    perform public.revive_meta_import('invalid','[]');
    raise exception 'Expected unauthorized import';
  exception when insufficient_privilege then null; end;
  imported := public.revive_meta_import(token,'[{"meta_lead_id":"REVIVE-TRANSACTION-TEST","full_name":"Synthetic Test","email":"revive-transaction-test@example.com","phone":"","lead_created_at":"2026-09-11T13:00:00Z","source_row":2,"meta":{"campaign_name":"Synthetic test"},"fitness_routine":"Test"}]');
  if (imported->>'imported')::int <> 1 then raise exception 'First import failed'; end if;
  select id into rowid from revive_private.meta_pass_leads where meta_lead_id='REVIVE-TRANSACTION-TEST';
  if (select activated_at is not null from revive_private.meta_pass_leads where id=rowid) then raise exception 'Import started pass'; end if;
  l := public.revive_meta_update(admin_token,rowid,1,'activate',true,'','');
  start_time := (l->>'activated_at')::timestamptz;
  if start_time is null then raise exception 'Activation did not start pass'; end if;
  l := public.revive_meta_update(admin_token,rowid,2,'notes',false,'Keep these notes','Recovery');
  l := public.revive_meta_update(admin_token,rowid,3,'do_not_contact',true,'','');
  imported := public.revive_meta_import(token,'[{"meta_lead_id":"REVIVE-TRANSACTION-TEST","full_name":"Synthetic Updated","email":"revive-transaction-test@example.com","phone":"","lead_created_at":"2026-09-11T13:00:00Z","source_row":3,"meta":{"campaign_name":"Updated source"},"fitness_routine":"Test"}]');
  select to_jsonb(x) into l from revive_private.meta_pass_leads x where id=rowid;
  if (l->>'activated_at')::timestamptz <> start_time or l->>'notes'<>'Keep these notes' or not (l->>'do_not_contact')::boolean then raise exception 'Reimport reset staff controls'; end if;
  if (select count(*) from revive_private.meta_pass_leads where meta_lead_id='REVIVE-TRANSACTION-TEST')<>1 then raise exception 'Duplicate imported'; end if;
  begin
    perform public.revive_meta_update(admin_token,rowid,1,'activate',false,'','');
    raise exception 'Stale update was allowed';
  exception when serialization_failure then null; end;
  l := public.revive_meta_update(admin_token,rowid,(l->>'version')::int,'joined',true,'','');
  if not (l->>'is_member')::boolean then raise exception 'Member toggle failed'; end if;
  if (select count(*) from revive_private.meta_lead_events where lead_id=rowid)<>4 then raise exception 'Edit history missing'; end if;
  l := public.revive_meta_list(admin_token,0,'revive-transaction-test@example.com','joined');
  if (l->>'total')::int<>1 or (l->>'emails_enabled')::boolean then raise exception 'List or email pause failed'; end if;
end $$;
set local role anon;
do $$ begin
  begin
    perform 1 from revive_private.meta_pass_leads;
    raise exception 'Anonymous table read was allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.revive_meta_list(null,0,'','all');
    raise exception 'Anonymous RPC read was allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: authorization, import deduplication, activation, preserved controls, version conflicts, edit history, and email pause' as result;
