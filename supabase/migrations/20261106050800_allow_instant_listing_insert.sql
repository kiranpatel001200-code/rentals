-- Keep RentNest's advertised instant-publish flow while retaining owner and moderation safeguards.
-- New listings may start approved only when they are created by their own active landlord.
drop policy if exists "Landlords insert own listings" on public.listings;

create policy "Landlords insert own listings"
on public.listings
as permissive
for insert
to authenticated
with check (
  landlord_id = (select auth.uid())
  and public.is_landlord((select auth.uid()))
  and not rentnest_private.is_blocked((select auth.uid()))
  and status = any (
    array[
      'draft'::public.listing_status,
      'pending'::public.listing_status,
      'approved'::public.listing_status
    ]
  )
  and is_featured = false
  and approved_by is null
  and approved_at is null
  and rejection_reason is null
  and view_count = 0
  and deleted_at is null
);
