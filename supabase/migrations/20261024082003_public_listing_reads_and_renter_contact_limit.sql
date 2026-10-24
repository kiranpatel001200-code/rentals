create schema if not exists rentnest_private;
grant usage on schema rentnest_private to anon, authenticated;

create or replace function rentnest_private.is_blocked(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(
    (select p.is_banned from public.profiles p where p.id = p_uid),
    false
  );
$$;
revoke all on function rentnest_private.is_blocked(uuid) from public;
grant execute on function rentnest_private.is_blocked(uuid) to anon, authenticated;

drop policy if exists "Blocked listings are hidden" on public.listings;
drop policy if exists "Blocked owners are hidden" on public.listings;
create policy "Blocked listing owners hidden from public"
on public.listings
as restrictive
for select
to anon, authenticated
using (
  not rentnest_private.is_blocked(landlord_id)
  or public.is_admin(auth.uid())
);

create table if not exists rentnest_private.contact_access_views (
  renter_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (renter_id, listing_id)
);
alter table rentnest_private.contact_access_views enable row level security;
revoke all on table rentnest_private.contact_access_views from public, anon, authenticated;

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

    if not exists (
      select 1
      from rentnest_private.contact_access_views v
      where v.renter_id = v_uid and v.listing_id = p_listing
    ) then
      select count(*)::integer into v_count
      from rentnest_private.contact_access_views v
      where v.renter_id = v_uid;

      if v_count >= 3 then
        return;
      end if;

      insert into rentnest_private.contact_access_views (renter_id, listing_id)
      values (v_uid, p_listing)
      on conflict (renter_id, listing_id) do nothing;
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

revoke all on function public.listing_contact_for_pass(uuid) from public, anon;
grant execute on function public.listing_contact_for_pass(uuid) to authenticated;

create or replace function public.my_contact_usage()
returns integer
language sql
stable
security definer
set search_path to ''
as $$
  select count(*)::integer
  from rentnest_private.contact_access_views v
  where v.renter_id = auth.uid();
$$;
revoke all on function public.my_contact_usage() from public, anon;
grant execute on function public.my_contact_usage() to authenticated;

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
          public.has_contact_pass(auth.uid())
          and exists (
            select 1
            from rentnest_private.contact_access_views v
            where v.renter_id = auth.uid()
              and v.listing_id = i.listing_id
          )
        )
      then lc.contact_email
    end,
    case
      when public.is_admin(auth.uid())
        or (
          public.has_contact_pass(auth.uid())
          and exists (
            select 1
            from rentnest_private.contact_access_views v
            where v.renter_id = auth.uid()
              and v.listing_id = i.listing_id
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
