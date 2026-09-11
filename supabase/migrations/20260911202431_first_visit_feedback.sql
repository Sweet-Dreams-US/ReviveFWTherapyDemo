alter table revive_private.meta_pass_leads
  add column visit_feedback jsonb,
  add column visit_feedback_at timestamptz;

-- Only the server may call this after verifying the signed personal link.
-- Guest feedback is separate from staff notes and cannot alter trial controls.
create function revive_private.pass_feedback(p_token text,p_id uuid,p_activated_at timestamptz,
  p_submit boolean,p_rating integer,p_areas text[],p_comments text,p_wants_help boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare l revive_private.meta_pass_leads; n revive_private.meta_pass_leads;
begin
  if not revive_private.check_sync(p_token) then raise exception 'unauthorized' using errcode='42501'; end if;
  select * into l from revive_private.meta_pass_leads where id=p_id for update;
  -- JS timestamps use milliseconds. A corrected activation invalidates the old link.
  if not found or l.activated_at is null or p_activated_at is null
    or date_trunc('milliseconds',l.activated_at) <> p_activated_at
    or l.activated_at + interval '30 days' <= now() then return null; end if;
  if p_submit and l.visit_feedback_at is null then
    if p_rating is null or p_rating not between 1 and 5 or p_areas is null
      or cardinality(p_areas) not between 1 and 2 or array_position(p_areas,null) is not null
      or not (p_areas <@ array['Gym','Recovery']::text[])
      or (select count(distinct a) from unnest(p_areas) a) <> cardinality(p_areas)
      or p_comments is null or length(p_comments)>2000 or p_wants_help is null then raise exception 'Invalid feedback'; end if;
    update revive_private.meta_pass_leads set
      visit_feedback=jsonb_build_object('rating',p_rating,'areas',p_areas,'comments',trim(p_comments),'wants_help',p_wants_help),
      visit_feedback_at=now(),version=version+1 where id=l.id returning * into n;
    insert into revive_private.meta_lead_events(lead_id,action,before_state,after_state)
      values(l.id,'guest_visit_feedback',to_jsonb(l),to_jsonb(n));
    l:=n;
  end if;
  -- No staff notes, phone, flags, or previously submitted comments are public.
  return jsonb_build_object('fullName',l.full_name,'email',l.email,'submitted',l.visit_feedback_at is not null);
end;
$$;
create function public.revive_pass_feedback(p_token text,p_id uuid,p_activated_at timestamptz,
  p_submit boolean,p_rating integer,p_areas text[],p_comments text,p_wants_help boolean)
returns jsonb language sql security invoker set search_path='' as $$
  select revive_private.pass_feedback(p_token,p_id,p_activated_at,p_submit,p_rating,p_areas,p_comments,p_wants_help)
$$;
revoke all on function revive_private.pass_feedback(text,uuid,timestamptz,boolean,integer,text[],text,boolean) from public;
revoke all on function public.revive_pass_feedback(text,uuid,timestamptz,boolean,integer,text[],text,boolean) from public;
grant execute on function revive_private.pass_feedback(text,uuid,timestamptz,boolean,integer,text[],text,boolean) to anon,authenticated;
grant execute on function public.revive_pass_feedback(text,uuid,timestamptz,boolean,integer,text[],text,boolean) to anon,authenticated;
