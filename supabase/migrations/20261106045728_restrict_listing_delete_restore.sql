-- Restrict soft delete and restore to narrow, owner-checked database functions.
create or replace function public.guard_listing_soft_delete()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_action text := coalesce(current_setting('app.listing_soft_delete_action', true), '');
begin
  if coalesce(current_setting('app.system_hide', true), '') = 'on' then
    return new;
  end if;

  if coalesce(nullif(current_setting('request.jwt.claims', true), ''), '') = '' then
    return new;
  end if;

  if public.is_admin(v_uid) then
    return new;
  end if;

  if old.deleted_at is not null then
    if new.deleted_at is not null
       or old.landlord_id is distinct from v_uid
       or v_action is distinct from ('restore:' || old.id::text) then
      raise exception 'Restore this listing using the Recently Deleted action.';
    end if;
  elsif new.deleted_at is not null then
    if old.landlord_id is distinct from v_uid
       or v_action is distinct from ('delete:' || old.id::text) then
      raise exception 'Move this listing to Recently Deleted using My Listings.';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function public.move_my_listing_to_recently_deleted(p_listing uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_listing_id uuid;
begin
  if v_uid is null or public.is_blocked(v_uid) then
    raise exception 'You must be signed in with an active account.';
  end if;

  select l.id into v_listing_id
  from public.listings l
  where l.id = p_listing
    and l.landlord_id = v_uid
    and l.deleted_at is null
  for update;

  if v_listing_id is null then
    return false;
  end if;

  perform set_config('app.listing_soft_delete_action', 'delete:' || v_listing_id::text, true);

  update public.listings
  set deleted_at = now()
  where id = v_listing_id
    and landlord_id = v_uid
    and deleted_at is null;

  return found;
end;
$function$;

create or replace function public.restore_my_listing(p_listing uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_listing_id uuid;
begin
  if v_uid is null or public.is_blocked(v_uid) then
    raise exception 'You must be signed in with an active account.';
  end if;

  select l.id into v_listing_id
  from public.listings l
  where l.id = p_listing
    and l.landlord_id = v_uid
    and l.deleted_at is not null
  for update;

  if v_listing_id is null then
    return false;
  end if;

  perform set_config('app.listing_soft_delete_action', 'restore:' || v_listing_id::text, true);

  update public.listings
  set deleted_at = null
  where id = v_listing_id
    and landlord_id = v_uid
    and deleted_at is not null;

  return found;
end;
$function$;

revoke all on function public.move_my_listing_to_recently_deleted(uuid) from public, anon;
grant execute on function public.move_my_listing_to_recently_deleted(uuid) to authenticated;
revoke all on function public.restore_my_listing(uuid) from public, anon;
grant execute on function public.restore_my_listing(uuid) to authenticated;
