create or replace function public.my_sent_inquiries()
returns table(
  id uuid,
  listing_id uuid,
  listing_title text,
  landlord_name text,
  message text,
  move_in_date date,
  wants_tour boolean,
  status text,
  created_at timestamptz,
  landlord_email text,
  landlord_phone text
)
language sql
stable
security definer
set search_path to ''
as $function$
  select
    i.id,
    i.listing_id,
    l.title,
    coalesce(nullif(lc.contact_name, ''), 'Landlord'),
    i.message,
    i.move_in_date,
    i.wants_tour,
    i.status,
    i.created_at,
    case
      when public.is_admin(auth.uid())
        or (
          exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'renter'
          )
          and public.has_contact_pass(auth.uid())
          and exists (
            select 1 from rentnest_private.contact_access_views v
            where v.renter_id = auth.uid()
              and v.listing_id = i.listing_id
              and v.viewed_at >= coalesce(
                (select cp.granted_at from public.contact_passes cp where cp.user_id = auth.uid()),
                'infinity'::timestamptz
              )
          )
        )
      then lc.contact_email
    end,
    case
      when public.is_admin(auth.uid())
        or (
          exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'renter'
          )
          and public.has_contact_pass(auth.uid())
          and exists (
            select 1 from rentnest_private.contact_access_views v
            where v.renter_id = auth.uid()
              and v.listing_id = i.listing_id
              and v.viewed_at >= coalesce(
                (select cp.granted_at from public.contact_passes cp where cp.user_id = auth.uid()),
                'infinity'::timestamptz
              )
          )
        )
      then lc.contact_phone
    end
  from public.inquiries i
  join public.listings l on l.id = i.listing_id
  left join public.listing_contacts lc on lc.listing_id = i.listing_id
  where i.renter_id = auth.uid()
    and not public.is_blocked(auth.uid())
  order by i.created_at desc;
$function$;

create or replace function public.my_contact_listing_unlocked(p_listing uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select public.is_admin(auth.uid()) or (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'renter'
    )
    and public.has_contact_pass(auth.uid())
    and exists (
      select 1
      from rentnest_private.contact_access_views v
      where v.renter_id = auth.uid()
        and v.listing_id = p_listing
        and v.viewed_at >= coalesce(
          (select cp.granted_at from public.contact_passes cp where cp.user_id = auth.uid()),
          'infinity'::timestamptz
        )
    )
  );
$$;
revoke all on function public.my_contact_listing_unlocked(uuid) from public, anon;
grant execute on function public.my_contact_listing_unlocked(uuid) to authenticated;
