create or replace function public.listing_contact_for_pass(p_listing uuid)
returns table(contact_name text, contact_email text, contact_phone text, contact_whatsapp text)
language plpgsql
volatile
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_count integer;
  v_admin boolean;
  v_granted_at timestamptz;
begin
  if v_uid is null or public.is_blocked(v_uid) then
    return;
  end if;

  v_admin := public.is_admin(v_uid);
  if not v_admin and not public.has_contact_pass(v_uid) then
    return;
  end if;

  if not exists (
    select 1
    from public.listings l
    where l.id = p_listing
      and l.status::text = 'approved'
      and (l.landlord_id <> v_uid or v_admin)
  ) or not exists (
    select 1 from public.listing_contacts lc where lc.listing_id = p_listing
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
    and (l.landlord_id <> v_uid or v_admin);
end;
$function$;

create or replace function public.my_contact_usage()
returns integer
language sql
stable
security definer
set search_path to ''
as $$
  select count(*)::integer
  from rentnest_private.contact_access_views v
  where v.renter_id = auth.uid()
    and v.viewed_at >= coalesce(
      (select cp.granted_at from public.contact_passes cp where cp.user_id = auth.uid()),
      '-infinity'::timestamptz
    );
$$;
revoke all on function public.my_contact_usage() from public, anon;
grant execute on function public.my_contact_usage() to authenticated;

create or replace function public.my_contact_listing_unlocked(p_listing uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select public.has_contact_pass(auth.uid())
    and exists (
      select 1
      from rentnest_private.contact_access_views v
      where v.renter_id = auth.uid()
        and v.listing_id = p_listing
        and v.viewed_at >= coalesce(
          (select cp.granted_at from public.contact_passes cp where cp.user_id = auth.uid()),
          'infinity'::timestamptz
        )
    );
$$;
revoke all on function public.my_contact_listing_unlocked(uuid) from public, anon;
grant execute on function public.my_contact_listing_unlocked(uuid) to authenticated;
