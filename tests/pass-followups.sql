-- No emails or persistent data: every mutation is rolled back.
begin;
do $$
declare token text; admin_token text; a uuid; b uuid; jid uuid; r jsonb; lease uuid; kind text; activation timestamptz:=now()-interval '3 hours';
begin
  select value into token from public.app_secrets where key='meta_sync_secret';
  select value into admin_token from public.app_secrets where key='admin_secret';
  assert revive_private.pass_followup_due('2026-09-12 16:00Z','experience')='2026-09-12 18:00Z'::timestamptz;
  assert revive_private.pass_followup_due('2026-09-12 16:00Z','day5')='2026-09-16 13:00Z'::timestamptz;
  assert revive_private.pass_followup_due('2026-10-29 16:00Z','day5')='2026-11-02 14:00Z'::timestamptz;
  assert revive_private.pass_followup_due('2026-10-29 16:00Z','day7')='2026-11-04 14:00Z'::timestamptz;
  insert into revive_private.meta_pass_leads(meta_lead_id,full_name,email,source_row,lead_created_at,meta)
    values('synthetic-followup-meta','Synthetic','synthetic-followup@example.com',0,now(),'{"platform":"fb"}') returning id into a;
  perform public.revive_claim_website_pass(token,'Synthetic','synthetic-followup@example.com','');
  select id into b from revive_private.meta_pass_leads where email='synthetic-followup@example.com' and id<>a;
  perform public.revive_plan_followups(token);
  assert not exists(select 1 from revive_private.pass_followup_jobs where email='synthetic-followup@example.com');
  update revive_private.meta_pass_leads set activated_at=activation where id=a;
  perform public.revive_meta_update(admin_token,b,(select version from revive_private.meta_pass_leads where id=b),'activate',true,'','');
  assert (select count(*) from revive_private.meta_pass_leads where email='synthetic-followup@example.com' and activated_at=activation)=2;
  perform public.revive_plan_followups(token);
  assert (select count(*) from revive_private.pass_followup_jobs where email='synthetic-followup@example.com')=3;
  assert (select count(*) from revive_private.pass_followup_jobs where email='synthetic-followup@example.com' and blocked_reason='Marketing consent required')=2;
  select id into jid from revive_private.pass_followup_jobs where email='synthetic-followup@example.com' and stage='experience';
  perform public.revive_meta_update(admin_token,a,(select version from revive_private.meta_pass_leads where id=a),'paused',true,'','');
  assert (public.revive_prepare_followup(token,jid,'{}'))->>'status'='blocked';
  perform public.revive_meta_update(admin_token,b,(select version from revive_private.meta_pass_leads where id=b),'paused',false,'','');
  r:=public.revive_prepare_followup(token,jid,'{"subject":"Frozen","to":["wrong@example.com"]}');lease:=(r->>'lease')::uuid;
  assert r->>'status'='ready';assert r->'payload'->'to'->>0='synthetic-followup@example.com';
  assert (public.revive_prepare_followup(token,jid,'{}'))->>'status'='waiting';
  perform public.revive_finish_followup(token,jid,gen_random_uuid(),'wrong-worker',null);
  assert (select status from revive_private.pass_followup_jobs where id=jid)='sending';
  perform public.revive_finish_followup(token,jid,lease,null,'synthetic transient failure');
  update revive_private.pass_followup_jobs set next_attempt_at=now() where id=jid;
  r:=public.revive_prepare_followup(token,jid,'{"subject":"Changed"}');
  assert r->'payload'->>'subject'='Frozen';
  perform public.revive_finish_followup(token,jid,(r->>'lease')::uuid,'synthetic-provider',null);
  assert (public.revive_prepare_followup(token,jid,'{}'))->>'status'='sent';
  perform public.revive_pass_marketing_consent(token,'synthetic-followup@example.com');
  perform public.revive_plan_followups(token);
  assert (select count(*) from revive_private.pass_followup_jobs where email='synthetic-followup@example.com' and blocked_reason is not null)=0;
  assert (public.revive_followup_state(admin_token,array[a]))->'jobs' is not null;
  assert not ((public.revive_followup_state(admin_token,array[a]))->'jobs'->0 ? 'payload');
  assert public.revive_unsubscribe_pass(token,a);
  assert (select count(*) from revive_private.meta_pass_leads where email='synthetic-followup@example.com' and email_unsubscribed_at is not null)=2;
  assert (select count(*) from revive_private.pass_followup_jobs where email='synthetic-followup@example.com' and status='suppressed')=2;
  assert public.revive_unsubscribe_pass(token,a);
  assert (select min(activated_at) from revive_private.meta_pass_leads where email='synthetic-followup@example.com')=activation;
  update revive_private.meta_pass_leads set marketing_consent_at=null where email='synthetic-followup@example.com';
  perform public.revive_pass_marketing_consent(token,'synthetic-followup@example.com');
  assert not exists(select 1 from revive_private.meta_pass_leads where email='synthetic-followup@example.com' and marketing_consent_at is not null);
  foreach kind in array array['joined','dnc','feedback','expired','notdue'] loop
    insert into revive_private.meta_pass_leads(meta_lead_id,full_name,email,source_row,lead_created_at,activated_at,is_member,do_not_contact,visit_feedback_at)
      values('synthetic-stop-'||kind,'Synthetic','synthetic-stop-'||kind||'@example.com',0,now(),
        case when kind='expired' then now()-interval '2 days' when kind='notdue' then now() else activation end,
        kind='joined',kind='dnc',case when kind='feedback' then now() end) returning id into a;
    perform public.revive_plan_followups(token);
    select id into jid from revive_private.pass_followup_jobs where lead_id=a and stage='experience';
    assert (public.revive_prepare_followup(token,jid,'{}'))->>'status'=case when kind='notdue' then 'waiting' else 'suppressed' end;
  end loop;
  begin perform public.revive_plan_followups(null);raise exception 'Unauthorized planner';exception when insufficient_privilege then null;end;
  begin perform public.revive_unsubscribe_pass('bad',a);raise exception 'Unauthorized unsubscribe';exception when insufficient_privilege then null;end;
  assert not has_table_privilege('anon','revive_private.pass_followup_jobs','SELECT');
  assert not has_table_privilege('authenticated','revive_private.pass_followup_jobs','UPDATE');
end $$;
rollback;
select 'PASS: schedule, DST, activation, duplicate lifecycle, pause, consent, lease, frozen retry, unsubscribe, authorization' as result;
