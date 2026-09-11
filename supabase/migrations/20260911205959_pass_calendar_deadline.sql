-- Redemption date is Day 1 in Fort Wayne. Day 7 ends at normal closing.
-- This changes derived expiry only; activation timestamps and sending controls stay intact.
create function revive_private.pass_expires_at(p_activated_at timestamptz)
returns timestamptz language sql stable strict security invoker set search_path='' as $$
  with last_day as (select (p_activated_at at time zone 'America/Indiana/Indianapolis')::date + 6 as d)
  select (d + case when extract(dow from d) in (0,6) then time '20:00' else time '23:00' end)
    at time zone 'America/Indiana/Indianapolis' from last_day
$$;
revoke all on function revive_private.pass_expires_at(timestamptz) from public,anon,authenticated;


create or replace function revive_private.list_meta(p_token text, p_offset integer, p_query text, p_filter text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb; counts jsonb; total integer; sync jsonb;
begin
  if not coalesce(public.revive_check_admin(p_token),false) then raise exception 'unauthorized' using errcode='42501'; end if;
  select jsonb_build_object('total',count(*), 'unactivated',count(*) filter(where activated_at is null and not is_member),
    'active',count(*) filter(where activated_at is not null and revive_private.pass_expires_at(activated_at)>now() and not is_member),
    'joined',count(*) filter(where is_member)) into counts from revive_private.meta_pass_leads;
  with matching as (
    select l.*, revive_private.pass_expires_at(l.activated_at) as pass_expires_at from revive_private.meta_pass_leads l
    where (coalesce(p_query,'')='' or strpos(lower(l.full_name || ' ' || l.email || ' ' || coalesce(l.phone,'')),lower(left(p_query,200)))>0)
    and case p_filter
      when 'unactivated' then l.activated_at is null and not l.is_member
      when 'active' then l.activated_at is not null and revive_private.pass_expires_at(l.activated_at)>now() and not l.is_member
      when 'expired' then revive_private.pass_expires_at(l.activated_at)<=now() and not l.is_member
      when 'joined' then l.is_member
      when 'paused' then l.automation_paused
      when 'do_not_contact' then l.do_not_contact
      else true end
  ), page as (select * from matching order by lead_created_at desc,id limit 100 offset greatest(p_offset,0))
  select (select count(*) from matching), coalesce(jsonb_agg(to_jsonb(page) order by lead_created_at desc,id),'[]') into total,result from page;
  select to_jsonb(s)-'locked_until' into sync from revive_private.meta_sync_state s where id=1;
  return jsonb_build_object('ok',true,'leads',result,'total',total,'stats',counts,'sync',sync,'emails_enabled',false);
end;
$$;
