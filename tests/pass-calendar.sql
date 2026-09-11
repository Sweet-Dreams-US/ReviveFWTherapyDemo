begin;
do $$
declare token text; result jsonb;
begin
  assert revive_private.pass_expires_at('2026-09-11T20:09:05Z')='2026-09-18T03:00:00Z'::timestamptz;
  assert revive_private.pass_expires_at('2026-09-13T15:00:00Z')='2026-09-20T00:00:00Z'::timestamptz;
  assert revive_private.pass_expires_at('2026-03-03T19:00:00Z')='2026-03-10T03:00:00Z'::timestamptz;
  assert revive_private.pass_expires_at('2026-10-27T18:00:00Z')='2026-11-03T04:00:00Z'::timestamptz;
  assert revive_private.pass_expires_at(null) is null;
  select value into token from public.app_secrets where key='admin_secret';
  result:=public.revive_meta_list(token,0,'','active');
  assert not (result->>'emails_enabled')::boolean;
  assert not exists(select 1 from jsonb_array_elements(result->'leads') l where (l->>'pass_expires_at')::timestamptz <= now());
  result:=public.revive_meta_list(token,0,'','expired');
  assert not exists(select 1 from jsonb_array_elements(result->'leads') l where (l->>'pass_expires_at')::timestamptz > now());
  begin
    perform public.revive_meta_list('wrong',0,'','all');
    raise exception 'Unauthorized list accepted';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
