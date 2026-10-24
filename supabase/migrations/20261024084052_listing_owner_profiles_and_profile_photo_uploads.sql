insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos',
  'profile-photos',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users read own profile photos" on storage.objects;
create policy "Users read own profile photos"
on storage.objects for select
to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and not public.is_blocked((select auth.uid()))
);

drop policy if exists "Users upload own profile photo" on storage.objects;
create policy "Users upload own profile photo"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and not public.is_blocked((select auth.uid()))
);

drop policy if exists "Users update own profile photo" on storage.objects;
create policy "Users update own profile photo"
on storage.objects for update
to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and not public.is_blocked((select auth.uid()))
)
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and not public.is_blocked((select auth.uid()))
);

drop policy if exists "Users delete own profile photo" on storage.objects;
create policy "Users delete own profile photo"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and not public.is_blocked((select auth.uid()))
);

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

revoke all on function public.listing_owner_public_profile(uuid) from public, anon, authenticated;
grant execute on function public.listing_owner_public_profile(uuid) to anon, authenticated;
