-- Admin-only free test Premium grants for individual listings.
create table if not exists public.admin_listing_premium_grants (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  granted_by uuid not null references public.profiles(id),
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  reason text not null default 'Free Premium grant for testing'
);

alter table public.admin_listing_premium_grants enable row level security;
revoke all on table public.admin_listing_premium_grants from public, anon, authenticated;
grant select on table public.admin_listing_premium_grants to authenticated;
drop policy if exists "Admins read free listing grants" on public.admin_listing_premium_grants;
create policy "Admins read free listing grants"
on public.admin_listing_premium_grants for select to authenticated
using (public.is_admin((select auth.uid())));

create or replace function public.admin_set_listing_free_premium(
  p_listing_id uuid, p_enabled boolean, p_days integer default 30
)
returns timestamptz
language plpgsql security definer set search_path to ''
as $function$
declare
  v_expiry timestamptz;
begin
  if not public.is_admin((select auth.uid())) then
    raise exception 'Administrator access is required.';
  end if;
  if p_listing_id is null then raise exception 'A listing ID is required.'; end if;
  perform 1 from public.listings l
    where l.id = p_listing_id and l.deleted_at is null
    for update;
  if not found then raise exception 'The listing was not found or has been deleted.'; end if;
  if p_enabled then
    if coalesce(p_days,30) < 1 or coalesce(p_days,30) > 365 then
      raise exception 'Free Premium duration must be between 1 and 365 days.';
    end if;
    v_expiry := now() + pg_catalog.make_interval(days => coalesce(p_days,30));
    insert into public.admin_listing_premium_grants(listing_id,granted_by,granted_at,expires_at,reason)
    values(p_listing_id,(select auth.uid()),now(),v_expiry,'Free Premium grant for testing')
    on conflict(listing_id) do update
      set granted_by=excluded.granted_by,granted_at=excluded.granted_at,
          expires_at=excluded.expires_at,reason=excluded.reason;
  else
    delete from public.admin_listing_premium_grants where listing_id=p_listing_id;
    v_expiry := null;
  end if;
  update public.listings set premium_priority=premium_priority where id=p_listing_id;
  return v_expiry;
end;
$function$;
revoke all on function public.admin_set_listing_free_premium(uuid,boolean,integer) from public, anon, authenticated;
grant execute on function public.admin_set_listing_free_premium(uuid,boolean,integer) to authenticated;

create or replace function rentnest_private.set_listing_priority_fields()
returns trigger language plpgsql security definer set search_path to ''
as $function$
declare v_until timestamptz;
begin
  if coalesce(new.is_featured,false) then
    new.premium_priority := true; new.premium_priority_until := null; return new;
  end if;
  select ls.current_period_end into v_until
  from public.landlord_subscriptions ls
  join public.subscription_plans sp on sp.id=ls.plan_id
  where ls.landlord_id=new.landlord_id
    and ls.status::text in ('active','trialing')
    and (ls.current_period_end is null or ls.current_period_end>now())
    and sp.priority_ranking=true
  order by ls.current_period_start desc limit 1;
  if found then
    new.premium_priority := true; new.premium_priority_until := v_until;
  else
    new.premium_priority := false; new.premium_priority_until := null;
  end if;
  return new;
end;
$function$;
revoke all on function rentnest_private.set_listing_priority_fields() from public, anon, authenticated;
