drop policy if exists "Owner, admin, or unlocked renter can view contact info" on public.listing_contacts;
create policy "Owners admins and eligible renters read listing contacts"
on public.listing_contacts
for select
to authenticated
using (
  exists (
    select 1
    from public.listings l
    where l.id = listing_contacts.listing_id
      and l.landlord_id = auth.uid()
  )
  or public.is_admin(auth.uid())
  or public.my_contact_listing_unlocked(listing_contacts.listing_id)
);

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 100),
  email text not null check (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'),
  topic text not null check (topic = any (array['Renting a home','Listing a property','Premium contact upgrade','Report a listing','Other'])),
  message text not null check (char_length(btrim(message)) between 10 and 2000),
  status text not null default 'new' check (status = any (array['new','in_progress','resolved'])),
  created_at timestamptz not null default now()
);
alter table public.support_requests enable row level security;
revoke all on public.support_requests from public, anon, authenticated;
grant insert (user_id, full_name, email, topic, message) on public.support_requests to anon, authenticated;
grant select, update on public.support_requests to authenticated;

drop policy if exists "Anyone can submit support requests" on public.support_requests;
create policy "Anyone can submit support requests"
on public.support_requests
for insert
to anon, authenticated
with check (
  (user_id is null or user_id = auth.uid())
  and not rentnest_private.is_blocked(auth.uid())
);
drop policy if exists "Admins view support requests" on public.support_requests;
create policy "Admins view support requests"
on public.support_requests
for select
to authenticated
using (public.is_admin(auth.uid()));
drop policy if exists "Admins update support requests" on public.support_requests;
create policy "Admins update support requests"
on public.support_requests
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));
