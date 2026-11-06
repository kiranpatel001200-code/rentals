-- Previously unlocked renter contacts must stop being readable once a listing is removed.
-- Keep owner/admin access to their own or moderated rows, but require an active public listing
-- for Contact Pass access through the table API as well as through listing_contact_for_pass().

create or replace function public.my_contact_listing_unlocked(p_listing uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select public.is_admin((select auth.uid())) or (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role::text = 'renter'
    )
    and public.has_contact_pass((select auth.uid()))
    and exists (
      select 1
      from public.listings l
      where l.id = p_listing
        and l.status::text = 'approved'
        and l.deleted_at is null
        and l.landlord_id <> (select auth.uid())
        and not rentnest_private.is_blocked(l.landlord_id)
    )
    and exists (
      select 1
      from rentnest_private.contact_access_views v
      where v.renter_id = (select auth.uid())
        and v.listing_id = p_listing
        and v.viewed_at >= coalesce(
          (select cp.granted_at
           from public.contact_passes cp
           where cp.user_id = (select auth.uid())),
          'infinity'::timestamptz
        )
    )
  );
$function$;

revoke all on function public.my_contact_listing_unlocked(uuid) from public, anon;
grant execute on function public.my_contact_listing_unlocked(uuid) to authenticated;

-- Defense in depth for direct listing_contacts API reads.
drop policy if exists "Only active listing contacts are readable" on public.listing_contacts;
create policy "Only active listing contacts are readable"
on public.listing_contacts
as restrictive
for select
to authenticated
using (
  exists (
    select 1
    from public.listings l
    where l.id = listing_contacts.listing_id
      and (
        l.landlord_id = (select auth.uid())
        or public.is_admin((select auth.uid()))
        or (
          l.status::text = 'approved'
          and l.deleted_at is null
          and not rentnest_private.is_blocked(l.landlord_id)
          and public.my_contact_listing_unlocked(listing_contacts.listing_id)
        )
      )
  )
);

-- Mirror the same availability rule for direct listing_images metadata reads.
drop policy if exists "Hide deleted listing image metadata from public" on public.listing_images;
create policy "Hide deleted listing image metadata from public"
on public.listing_images
as restrictive
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.listings l
    where l.id = listing_images.listing_id
      and (
        l.deleted_at is null
        or l.landlord_id = (select auth.uid())
        or public.is_admin((select auth.uid()))
      )
  )
);
