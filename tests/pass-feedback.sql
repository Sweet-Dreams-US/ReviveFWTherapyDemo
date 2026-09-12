begin;
do $$
declare secret text; v_lead_id uuid; activated timestamptz:=date_trunc('milliseconds',now()); result jsonb; l revive_private.meta_pass_leads;
begin
  select value into secret from public.app_secrets where key='meta_sync_secret';
  insert into revive_private.meta_pass_leads(meta_lead_id,full_name,email,lead_created_at,source_row,activated_at,notes,feedback)
    values('test-feedback:'||gen_random_uuid(),'Feedback Test','feedback-test@example.com',now(),0,activated,'Keep staff notes','Keep staff feedback') returning meta_pass_leads.id into v_lead_id;
  begin
    perform public.revive_pass_feedback('wrong',v_lead_id,activated,false,null,'{}','',false);
    raise exception 'Unauthorized access succeeded';
  exception when insufficient_privilege then null; end;
  result:=public.revive_pass_feedback(secret,v_lead_id,activated,false,null,'{}','',false);
  assert result->>'email'='feedback-test@example.com' and not (result->>'submitted')::boolean;
  assert not result ? 'notes' and not result ? 'feedback';
  assert public.revive_pass_feedback(secret,v_lead_id,activated-interval '1 second',false,null,'{}','',false) is null;
  begin
    perform public.revive_pass_feedback(secret,v_lead_id,activated,true,9,array['Gym'],'Bad',false);
    raise exception 'Invalid rating accepted';
  exception when raise_exception then if sqlerrm <> 'Invalid feedback' then raise; end if; end;
  result:=public.revive_pass_feedback(secret,v_lead_id,activated,true,5,array['Gym','Recovery'],'Loved it',true);
  assert (result->>'submitted')::boolean;
  perform public.revive_pass_feedback(secret,v_lead_id,activated,true,1,array['Gym'],'Overwrite attempt',false);
  select * into l from revive_private.meta_pass_leads where meta_pass_leads.id=v_lead_id;
  assert l.visit_feedback->>'comments'='Loved it' and l.visit_feedback->>'rating'='5';
  assert l.feedback='Keep staff feedback' and l.notes='Keep staff notes';
  assert l.activated_at=activated and not l.automation_paused and not l.is_member;
  assert (select count(*) from revive_private.meta_lead_events where lead_id=v_lead_id and action='guest_visit_feedback')=1;
  assert not has_table_privilege('anon','revive_private.meta_pass_leads','SELECT');
  assert not has_table_privilege('anon','revive_private.meta_pass_leads','UPDATE');
end $$;
rollback;
