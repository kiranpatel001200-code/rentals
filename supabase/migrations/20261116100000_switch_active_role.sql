-- One login, two modes: Renter and Landlord (like Airbnb's Traveling / Hosting).
-- profiles.role stays the ACTIVE mode, so every existing page and policy keeps working.
-- This function is the supported way for a signed-in user to change it with one tap.
-- Nothing is deleted when someone switches: listings, sent messages, Contact Pass and Landlord Premium stay with the account.
-- Admin accounts cannot switch.

create or replace function public.switch_my_role(p_role text)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_current text;
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

  select pr.role::text into v_current from public.profiles pr where pr.id = v_uid;
  if not found then
    raise exception 'Profile not found.';
  end if;
  if coalesce(v_current, '') not in ('renter', 'landlord') then
    raise exception 'This account type cannot switch modes.';
  end if;

  if v_current <> p_role then
    -- format(%L) builds a quoted literal, so this works whether profiles.role is text or an enum.
    execute format('update public.profiles set role = %L where id = %L', p_role, v_uid);
  end if;
  return p_role;
end;
$function$;

revoke all on function public.switch_my_role(text) from public, anon;
grant execute on function public.switch_my_role(text) to authenticated;
