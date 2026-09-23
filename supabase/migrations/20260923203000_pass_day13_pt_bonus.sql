-- Day 13 reopens the approved Kings Nutrition PT joining bonus instead of a six
-- month preferred rate, which REVIVE is not offering. It sends at 9 AM on Day 13
-- and never after closing that day, because the email promises "today only".
create function revive_private.pass_day_close(p_activation timestamptz,p_day integer) returns timestamptz
language sql stable strict set search_path='' as $$
  with closing_day as (select (p_activation at time zone 'America/Indiana/Indianapolis')::date+(p_day-1) as d)
  select (d+case when extract(dow from d) in(0,6) then time '20:00' else time '23:00' end)
    at time zone 'America/Indiana/Indianapolis' from closing_day
$$;
revoke all on function revive_private.pass_day_close(timestamptz,integer) from public;

create or replace function revive_private.plan_followups(p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g record; s text; due timestamptz; expiry timestamptz; reason text; result jsonb;
begin
  if not revive_private.check_sync(p_token) then raise exception 'unauthorized' using errcode='42501'; end if;
  for g in select email,min(activated_at) as activation,
    (array_agg(id order by activated_at nulls last,lead_created_at,id))[1] as lead_id,
    bool_or(is_member) as member,bool_or(do_not_contact) as dnc,bool_or(automation_paused) as paused,
    bool_or(email_unsubscribed_at is not null) as unsubscribed,
    bool_or(visit_feedback_at is not null) as has_feedback
    from revive_private.meta_pass_leads group by email having min(activated_at) is not null
  loop
    foreach s in array array['experience','day5','day7','day10','day13'] loop
      due:=revive_private.pass_followup_due(g.activation,s);
      -- Day 10 may catch up until Day 13 opens; Day 13's bonus ends at closing that day.
      expiry:=case when s='experience' then g.activation+interval '24 hours'
        when s='day5' then due+interval '15 hours'
        when s='day7' then revive_private.pass_expires_at(g.activation)
        when s='day10' then due+interval '72 hours'
        else revive_private.pass_day_close(g.activation,13) end;
      insert into revive_private.pass_followup_jobs(lead_id,email,stage,activated_at,due_at,expires_at)
        values(g.lead_id,g.email,s,g.activation,due,expiry) on conflict(email,stage) do update
        set lead_id=excluded.lead_id,activated_at=excluded.activated_at,due_at=excluded.due_at,expires_at=excluded.expires_at
        where pass_followup_jobs.first_attempt_at is null and pass_followup_jobs.status='pending';
      reason:=case when g.dnc then 'Do not contact' when g.member then 'Already joined' when g.unsubscribed then 'Unsubscribed'
        when s='experience' and g.has_feedback then 'Feedback already received'
        when now()>=expiry then 'Send window ended' when g.paused then 'Paused by staff' else null end;
      update revive_private.pass_followup_jobs set blocked_reason=reason,
        status=case when reason in('Do not contact','Already joined','Unsubscribed','Feedback already received','Send window ended') then 'suppressed'
          when first_attempt_at<now()-interval '23 hours' or attempts>=8 then 'needs_review' else 'pending' end
        where email=g.email and stage=s and status in('pending','sending') and coalesce(locked_until,now())<=now();
    end loop;
  end loop;
  select coalesce(jsonb_agg(to_jsonb(j)),'[]') into result from (
    select id,lead_id,email,stage,activated_at from revive_private.pass_followup_jobs
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
  return jsonb_build_object('jobs',jobs,'run',run);
end;
$$;

-- Nothing was ever saved or sent under the rate offer; the next planner run
-- recomputes each Day 13 window against its closing time.
update revive_private.pass_followup_jobs set blocked_reason=null
  where stage='day13' and status='pending' and blocked_reason='Six month rates not set';
drop function public.revive_set_six_month_rates(text,numeric,numeric,numeric);
drop function revive_private.set_six_month_rates(text,numeric,numeric,numeric);
drop function revive_private.six_month_offer();
drop table revive_private.pass_offer_settings;
