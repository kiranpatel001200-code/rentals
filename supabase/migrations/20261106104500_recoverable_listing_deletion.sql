-- RentNest recoverable listing deletion ("Recently Deleted").
-- The existing UUID/slug and all related photos, contacts, messages and history are retained.

alter table public.listings
  add column if not exists deleted_at timestamptz;

create index if not exists listings_owner_recently_deleted_idx
  on public.listings (landlord_id, deleted_at, created_at desc);

-- Public callers can only read active listings. Owners can see their own removed
-- listings in My Listings, and admins can still moderate every row.
drop policy if exists "Hide deleted and blocked listings from public" on public.listings;
create policy "Hide deleted and blocked listings from public"
on public.listings
as restrictive
for select
to anon, authenticated
using (
  (
    deleted_at is null
    or landlord_id = (select auth.uid())
    or public.is_admin((select auth.uid()))
  )
  and (
    not rentnest_private.is_blocked(landlord_id)
    or public.is_admin((select auth.uid()))
  )
);

-- A blocked owner with a stale JWT cannot edit listings.
drop policy if exists "Block listing writes by banned owners" on public.listings;
create policy "Block listing writes by banned owners"
on public.listings
as restrictive
for update
to authenticated
using (
  not rentnest_private.is_blocked(landlord_id)
  or public.is_admin((select auth.uid()))
)
with check (
  not rentnest_private.is_blocked(landlord_id)
  or public.is_admin((select auth.uid()))
);

-- Owners may move an active listing to Recently Deleted and restore it.
-- While it is removed, only a restore is allowed; changing its contents first
-- requires restoring it. Admin maintenance and block-trigger operations bypass
-- this owner-facing guard.
create or replace function public.guard_listing_soft_delete()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
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
    if new.deleted_at is not null then
      raise exception 'This listing is in Recently Deleted. Restore it before editing.';
    end if;

    if old.landlord_id is distinct from v_uid
       or (to_jsonb(new) - 'deleted_at' - 'updated_at')
          is distinct from
          (to_jsonb(old) - 'deleted_at' - 'updated_at') then
      raise exception 'Restore this listing before changing its details.';
    end if;
  elsif new.deleted_at is not null
        and old.landlord_id is distinct from v_uid then
    raise exception 'Only the listing owner can move this listing to Recently Deleted.';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_listings_soft_delete_guard on public.listings;
create trigger trg_listings_soft_delete_guard
before update on public.listings
for each row execute function public.guard_listing_soft_delete();

-- Listing caps count only active listings. Restoring an item checks the current
-- cap again so the Recently Deleted folder cannot bypass a landlord plan.
create or replace function public.enforce_listing_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_max_listings integer;
  v_current_count integer;
begin
  if tg_op = 'UPDATE'
     and (old.deleted_at is null or new.deleted_at is not null) then
    return new;
  end if;

  select sp.max_listings into v_max_listings
  from public.landlord_subscriptions ls
  join public.subscription_plans sp on sp.id = ls.plan_id
  where ls.landlord_id = new.landlord_id
    and ls.status in ('active', 'trialing')
  order by ls.current_period_start desc
  limit 1;

  if not found then
    select max_listings into v_max_listings
    from public.subscription_plans
    where slug = 'free';
  end if;

  if v_max_listings is not null and new.status <> 'rejected' then
    select count(*) into v_current_count
    from public.listings
    where landlord_id = new.landlord_id
      and status <> 'rejected'
      and deleted_at is null;

    if v_current_count >= v_max_listings then
      raise exception 'Listing limit reached for your current plan (% listings). Upgrade to Premium for more listings.', v_max_listings;
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_listings_enforce_limit on public.listings;
create trigger trg_listings_enforce_limit
before insert or update of deleted_at on public.listings
for each row execute function public.enforce_listing_limit();

-- Do not expose the owner profile or premium contact details of a deleted item.
create or replace function public.listing_owner_public_profile(p_listing uuid)
returns table(owner_first_name text, owner_avatar_url text, joined_year integer)
language sql
stable
security definer
set search_path to ''
as $function$
  select
    coalesce(
      nullif(split_part(btrim(coalesce(p.full_name, '')), ' ', 1), ''),
      'Landlord'
    ) as owner_first_name,
    p.avatar_url as owner_avatar_url,
    extract(year from p.created_at)::integer as joined_year
  from public.listings l
  join public.profiles p on p.id = l.landlord_id
  where l.id = p_listing
    and l.deleted_at is null
    and (
      l.status::text = 'approved'
      or l.landlord_id = (select auth.uid())
      or public.is_admin((select auth.uid()))
    )
    and (
      not rentnest_private.is_blocked(l.landlord_id)
      or public.is_admin((select auth.uid()))
    );
$function$;

create or replace function public.listing_contact_for_pass(p_listing uuid)
returns table(contact_name text, contact_email text, contact_phone text, contact_whatsapp text)
language plpgsql
volatile
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_count integer;
  v_admin boolean;
  v_role text;
  v_granted_at timestamptz;
begin
  if v_uid is null or public.is_blocked(v_uid) then
    return;
  end if;

  v_admin := public.is_admin(v_uid);
  if not v_admin then
    select p.role::text into v_role
    from public.profiles p
    where p.id = v_uid;

    if v_role is distinct from 'renter'
       or not public.has_contact_pass(v_uid) then
      return;
    end if;
  end if;

  if not exists (
    select 1
    from public.listings l
    where l.id = p_listing
      and l.status::text = 'approved'
      and l.deleted_at is null
      and (l.landlord_id <> v_uid or v_admin)
  ) or not exists (
    select 1
    from public.listing_contacts lc
    where lc.listing_id = p_listing
  ) then
    return;
  end if;

  if not v_admin then
    perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));
    select cp.granted_at into v_granted_at
    from public.contact_passes cp
    where cp.user_id = v_uid;

    if v_granted_at is null then
      return;
    end if;

    if not exists (
      select 1
      from rentnest_private.contact_access_views v
      where v.renter_id = v_uid
        and v.listing_id = p_listing
        and v.viewed_at >= v_granted_at
    ) then
      select count(*)::integer into v_count
      from rentnest_private.contact_access_views v
      where v.renter_id = v_uid
        and v.viewed_at >= v_granted_at;

      if v_count >= 3 then
        return;
      end if;

      insert into rentnest_private.contact_access_views (renter_id, listing_id)
      values (v_uid, p_listing)
      on conflict (renter_id, listing_id) do update
      set viewed_at = excluded.viewed_at
      where rentnest_private.contact_access_views.viewed_at < v_granted_at;
    end if;
  end if;

  return query
  select lc.contact_name, lc.contact_email, lc.contact_phone, lc.contact_whatsapp
  from public.listing_contacts lc
  join public.listings l on l.id = lc.listing_id
  where lc.listing_id = p_listing
    and l.status::text = 'approved'
    and l.deleted_at is null
    and (l.landlord_id <> v_uid or v_admin);
end;
$function$;

revoke all on function public.listing_owner_public_profile(uuid) from public, anon, authenticated;
grant execute on function public.listing_owner_public_profile(uuid) to anon, authenticated;

revoke all on function public.listing_contact_for_pass(uuid) from public, anon;
grant execute on function public.listing_contact_for_pass(uuid) to authenticated;

-- A deleted listing cannot receive messages, even through a direct API call.
create or replace function public.prepare_inquiry()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  l record;
  n int;
begin
  select id, landlord_id, status, deleted_at
  into l
  from public.listings
  where id = new.listing_id;

  if not found
     or l.status <> 'approved'
     or l.deleted_at is not null
     or public.is_blocked(l.landlord_id) then
    raise exception 'This listing is not available.';
  end if;

  if l.landlord_id = new.renter_id then
    raise exception 'You cannot message your own listing.';
  end if;

  if exists (
    select 1
    from public.inquiries
    where renter_id = new.renter_id
      and listing_id = new.listing_id
  ) then
    raise exception 'You already sent a message about this listing. You can read it in Messages.';
  end if;

  select count(*) into n
  from public.inquiries
  where renter_id = new.renter_id
    and created_at > now() - interval '24 hours';

  if n >= 20 then
    raise exception 'You reached the daily limit of messages. Please try again tomorrow.';
  end if;

  new.landlord_id := l.landlord_id;
  return new;
end;
$function$;

revoke all on function public.prepare_inquiry() from public, anon, authenticated;
grant execute on function public.prepare_inquiry() to service_role;

