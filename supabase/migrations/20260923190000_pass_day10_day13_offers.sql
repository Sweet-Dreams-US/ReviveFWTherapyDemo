-- Day 10 and Day 13 from the 7 day pass proposal (REVIVE_Automated_7_Day_Pass_Proposal.xlsx):
-- Day 10 recovers guests who did not join with three additional trial days.
-- Day 13 offers a six month commitment at a preferred rate. The proposal never set
-- that rate, so Day 13 holds until staff record all three rates in admin.
alter table revive_private.pass_followup_jobs drop constraint pass_followup_jobs_stage_check;
alter table revive_private.pass_followup_jobs add constraint pass_followup_jobs_stage_check
  check(stage in('experience','day5','day7','day10','day13'));

create table revive_private.pass_offer_settings(
  id integer primary key check(id=1),
  six_month_essential numeric(7,2) check(six_month_essential>0),
  six_month_plus numeric(7,2) check(six_month_plus>0),
  six_month_elite numeric(7,2) check(six_month_elite>0),
  updated_at timestamptz
);
insert into revive_private.pass_offer_settings(id) values(1);
alter table revive_private.pass_offer_settings enable row level security;
revoke all on revive_private.pass_offer_settings from public,anon,authenticated;

-- Null until every tier has a rate, so a half entered offer can never send.
create function revive_private.six_month_offer() returns jsonb
language sql stable set search_path='' as $$
  select case when six_month_essential is not null and six_month_plus is not null and six_month_elite is not null
    then jsonb_build_object('essential',six_month_essential,'plus',six_month_plus,'elite',six_month_elite) end
  from revive_private.pass_offer_settings where id=1
$$;
revoke all on function revive_private.six_month_offer() from public;

create or replace function revive_private.pass_followup_due(p_activation timestamptz,p_stage text) returns timestamptz
language sql immutable set search_path='' as $$
  select case when p_stage='experience' then p_activation+interval '2 hours'
    when p_stage in('day5','day7','day10','day13') then (((p_activation at time zone 'America/Indiana/Indianapolis')::date+
      case p_stage when 'day5' then 4 when 'day7' then 6 when 'day10' then 9 else 12 end)+time '09:00') at time zone 'America/Indiana/Indianapolis' end;
$$;

-- Day 10 and Day 13 each get a 72 hour catch up window, so Day 10 closes exactly
-- when Day 13 opens and the two offers never go out out of order.
create or replace function revive_private.plan_followups(p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g record; s text; due timestamptz; expiry timestamptz; reason text; result jsonb; v_offer jsonb;
begin
  if not revive_private.check_sync(p_token) then raise exception 'unauthorized' using errcode='42501'; end if;
  v_offer:=revive_private.six_month_offer();
  for g in select email,min(activated_at) as activation,
    (array_agg(id order by activated_at nulls last,lead_created_at,id))[1] as lead_id,
    bool_or(is_member) as member,bool_or(do_not_contact) as dnc,bool_or(automation_paused) as paused,
    bool_or(email_unsubscribed_at is not null) as unsubscribed,
    bool_or(visit_feedback_at is not null) as has_feedback
    from revive_private.meta_pass_leads group by email having min(activated_at) is not null
  loop
    foreach s in array array['experience','day5','day7','day10','day13'] loop
      due:=revive_private.pass_followup_due(g.activation,s);
      expiry:=case when s='experience' then g.activation+interval '24 hours'
        when s='day5' then due+interval '15 hours'
        when s='day7' then revive_private.pass_expires_at(g.activation)
        else due+interval '72 hours' end;
      insert into revive_private.pass_followup_jobs(lead_id,email,stage,activated_at,due_at,expires_at)
        values(g.lead_id,g.email,s,g.activation,due,expiry) on conflict(email,stage) do update
        set lead_id=excluded.lead_id,activated_at=excluded.activated_at,due_at=excluded.due_at,expires_at=excluded.expires_at
        where pass_followup_jobs.first_attempt_at is null and pass_followup_jobs.status='pending';
      reason:=case when g.dnc then 'Do not contact' when g.member then 'Already joined' when g.unsubscribed then 'Unsubscribed'
        when s='experience' and g.has_feedback then 'Feedback already received'
        when now()>=expiry then 'Send window ended' when g.paused then 'Paused by staff'
        when s='day13' and v_offer is null then 'Six month rates not set' else null end;
      update revive_private.pass_followup_jobs set blocked_reason=reason,
        status=case when reason in('Do not contact','Already joined','Unsubscribed','Feedback already received','Send window ended') then 'suppressed'
          when first_attempt_at<now()-interval '23 hours' or attempts>=8 then 'needs_review' else 'pending' end
        where email=g.email and stage=s and status in('pending','sending') and coalesce(locked_until,now())<=now();
    end loop;
  end loop;
  select coalesce(jsonb_agg(to_jsonb(j)),'[]') into result from (
    select id,lead_id,email,stage,activated_at,case when stage='day13' then v_offer end as offer
      from revive_private.pass_followup_jobs
      where status='pending' and blocked_reason is null and due_at<=now() and expires_at>now()
      and next_attempt_at<=now() and coalesce(locked_until,now())<=now() order by due_at limit 6
  ) j;
  return result;
end;
$$;

create or replace function revive_private.prepare_followup(p_token text,p_id uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j revive_private.pass_followup_jobs; g record; v_lease uuid;
begin
  if not revive_private.check_sync(p_token) then raise exception 'unauthorized' using errcode='42501'; end if;
  select * into j from revive_private.pass_followup_jobs where id=p_id for update;
  if not found then return jsonb_build_object('status','missing'); end if;
  if j.status not in('pending','sending') then return jsonb_build_object('status',j.status); end if;
  if j.locked_until>now() or j.next_attempt_at>now() or j.due_at>now() then return jsonb_build_object('status','waiting'); end if;
  select min(activated_at) as activation,bool_or(is_member or do_not_contact or email_unsubscribed_at is not null) as suppressed,
    bool_or(automation_paused) as paused,
    bool_or(visit_feedback_at is not null) as has_feedback into g from revive_private.meta_pass_leads where email=j.email;
  if g.activation is distinct from j.activated_at or g.suppressed or j.expires_at<=now() or
    (j.stage='experience' and g.has_feedback) or not exists(select 1 from revive_private.meta_pass_leads where id=j.lead_id and email=j.email) then
    update revive_private.pass_followup_jobs set status='suppressed',blocked_reason='Pass state changed or send window ended' where id=j.id;
    return jsonb_build_object('status','suppressed');
  end if;
  if g.paused then return jsonb_build_object('status','blocked'); end if;
  if j.stage='day13' and revive_private.six_month_offer() is null then return jsonb_build_object('status','blocked'); end if;
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

create or replace function revive_private.followup_state(p_token text,p_ids uuid[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare jobs jsonb; run jsonb;
begin
  if not coalesce(public.revive_check_admin(p_token),false) then raise exception 'unauthorized' using errcode='42501'; end if;
  if cardinality(p_ids)>100 then raise exception 'Too many leads'; end if;
  select coalesce(jsonb_agg(to_jsonb(j)-'payload'-'lease'),'[]') into jobs from revive_private.pass_followup_jobs j
    where email in(select email from revive_private.meta_pass_leads where id=any(p_ids));
  select to_jsonb(s) into run from revive_private.pass_automation_state s where id=1;
  return jsonb_build_object('jobs',jobs,'run',run,'offer',revive_private.six_month_offer());
end;
$$;

create function revive_private.set_six_month_rates(p_token text,p_essential numeric,p_plus numeric,p_elite numeric) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if not coalesce(public.revive_check_admin(p_token),false) then raise exception 'unauthorized' using errcode='42501'; end if;
  if num_nulls(p_essential,p_plus,p_elite) not in(0,3) then raise exception 'Enter all three rates, or clear all three'; end if;
  update revive_private.pass_offer_settings set six_month_essential=p_essential,six_month_plus=p_plus,six_month_elite=p_elite,updated_at=now() where id=1;
  return revive_private.six_month_offer();
end;
$$;
create function public.revive_set_six_month_rates(p_token text,p_essential numeric,p_plus numeric,p_elite numeric) returns jsonb
language sql security invoker set search_path='' as $$ select revive_private.set_six_month_rates(p_token,p_essential,p_plus,p_elite) $$;
revoke all on function revive_private.set_six_month_rates(text,numeric,numeric,numeric) from public;
revoke all on function public.revive_set_six_month_rates(text,numeric,numeric,numeric) from public;
grant execute on function revive_private.set_six_month_rates(text,numeric,numeric,numeric) to anon,authenticated;
grant execute on function public.revive_set_six_month_rates(text,numeric,numeric,numeric) to anon,authenticated;
