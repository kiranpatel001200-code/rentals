-- My Account is the only place with a mode switch. The RPC temporarily clears the request claims
-- only while this one role update runs, so the existing profile privilege-escalation trigger
-- continues to reject direct client attempts to change role, verification, or ban status.
-- The caller id is captured and validated before clearing claims.
create or replace function public.switch_my_role(p_role text)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_current text;
  v_request_claims text := current_setting('request.jwt.claims', true);
begin
  if v_uid is null then
    raise exception 'Please log in first.';
  end if;
  if p_role is null or p_role not in ('renter', 'landlord') then
    raise exception 'Choose renter or landlord.';
  end if;
  if public.is_blocked(v_uid) then
    raise exception 'This account is not available.';
  end if;

  select pr.role::text into v_current
  from public.profiles pr
  where pr.id = v_uid;

  if not found then
    raise exception 'Profile not found.';
  end if;
  if coalesce(v_current, '') not in ('renter', 'landlord') then
    raise exception 'This account type cannot switch modes.';
  end if;

  if v_current <> p_role then
    -- The trigger intentionally permits database-internal updates with no request JWT claims.
    -- Keep this exception confined to the single update performed by this SECURITY DEFINER RPC.
    perform set_config('request.jwt.claims', '', true);
    begin
      update public.profiles
      set role = p_role
      where id = v_uid;
      if not found then
        raise exception 'Profile not found.';
      end if;
    exception when others then
      perform set_config('request.jwt.claims', coalesce(v_request_claims, ''), true);
      raise;
    end;
    perform set_config('request.jwt.claims', coalesce(v_request_claims, ''), true);
  end if;

  return p_role;
end;
$function$;

revoke all on function public.switch_my_role(text) from public, anon;
grant execute on function public.switch_my_role(text) to authenticated;

-- Public listing view counts are intentional, but a caller must not inflate counts for
-- deleted listings or listings owned by blocked accounts.
create or replace function public.increment_listing_view(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_owner uuid;
begin
  update public.listings l
  set view_count = l.view_count + 1
  where l.id = p_listing_id
    and l.status::text = 'approved'
    and l.deleted_at is null
    and not rentnest_private.is_blocked(l.landlord_id)
  returning l.landlord_id into v_owner;

  if found then
    insert into public.listing_view_events (listing_id, viewer_id, viewer_ip)
    values (p_listing_id, auth.uid(), inet_client_addr());
  end if;
end;
$function$;
