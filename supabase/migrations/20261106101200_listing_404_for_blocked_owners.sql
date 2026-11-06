-- Blocked owners must never be able to read their own listings with an old/stale session.
-- Admins retain database access for moderation, while listing.html redirects blocked-owner URLs to 404.
drop policy if exists "Blocked listing owners hidden from all non-admins" on public.listings;

create policy "Blocked listing owners hidden from all non-admins"
on public.listings
as restrictive
for select
to anon, authenticated
using (
  not rentnest_private.is_blocked(landlord_id)
  or public.is_admin((select auth.uid()))
);
