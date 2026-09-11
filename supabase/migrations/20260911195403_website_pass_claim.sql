-- Website claims share the existing staff lead controls, but never overwrite them.
create unique index meta_pass_leads_website_email_idx
on revive_private.meta_pass_leads (email) where meta->>'platform' = 'website';

create function revive_private.claim_website_pass(p_token text, p_name text, p_email text, p_phone text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if not revive_private.check_sync(p_token) then raise exception 'unauthorized' using errcode='42501'; end if;
  if p_name is null or length(trim(p_name)) not between 1 and 240
    or p_email is null or length(p_email)>200 or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    or length(coalesce(p_phone,''))>40 then raise exception 'Invalid claim'; end if;
  insert into revive_private.meta_pass_leads
    (meta_lead_id,full_name,email,phone,lead_created_at,source_row,meta,is_member)
  values ('web:'||gen_random_uuid()::text,trim(p_name),lower(trim(p_email)),nullif(trim(p_phone),''),
    now(),0,jsonb_build_object('platform','website','source','/free-pass','form_name','Website 7-Day Pass',
      'privacy_version','2026-09-11','marketing_consent',false),
    exists(select 1 from public.inquiries where lower(email)=lower(trim(p_email)) and is_member=true))
  on conflict do nothing;
  -- Identical response for new/repeated claims: no existing lead information is disclosed.
  return true;
end;
$$;
create function public.revive_claim_website_pass(p_token text,p_name text,p_email text,p_phone text)
returns boolean language sql security invoker set search_path='' as $$
  select revive_private.claim_website_pass(p_token,p_name,p_email,p_phone)
$$;
revoke all on function revive_private.claim_website_pass(text,text,text,text) from public;
revoke all on function public.revive_claim_website_pass(text,text,text,text) from public;
grant execute on function revive_private.claim_website_pass(text,text,text,text) to anon,authenticated;
grant execute on function public.revive_claim_website_pass(text,text,text,text) to anon,authenticated;
