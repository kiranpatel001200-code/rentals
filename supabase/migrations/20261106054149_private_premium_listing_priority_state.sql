-- Store only the public search-priority state on each listing.
-- The subscription tables remain private to authenticated owner/admin policies.
alter table public.listings
  add column if not exists premium_priority boolean not null default false,
  add column if not exists premium_priority_until timestamptz;

drop view if exists public.premium_listing_priorities;
drop function if exists public.get_premium_priority_listing_ids(uuid[]);

create or replace function rentnest_private.set_listing_priority_fields()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_until timestamptz;
begin
  if coalesce(new.is_featured, false) then
    new.premium_priority := true;
    new.premium_priority_until := null;
    return new;
  end if;

  select ls.current_period_end
  into v_until
  from public.landlord_subscriptions ls
  join public.subscription_plans sp on sp.id = ls.plan_id
  where ls.landlord_id = new.landlord_id
    and ls.status::text in ('active', 'trialing')
    and (ls.current_period_end is null or ls.current_period_end > now())
    and sp.priority_ranking = true
  order by ls.current_period_start desc
  limit 1;

  if found then
    new.premium_priority := true;
    new.premium_priority_until := v_until;
  else
    new.premium_priority := false;
    new.premium_priority_until := null;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_set_listing_priority_fields on public.listings;
create trigger trg_set_listing_priority_fields
before insert or update on public.listings
for each row execute function rentnest_private.set_listing_priority_fields();

create or replace function rentnest_private.refresh_listing_priority_on_subscription()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_old_owner uuid;
  v_new_owner uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_old_owner := old.landlord_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_new_owner := new.landlord_id;
  end if;

  if v_old_owner is not null then
    update public.listings
    set premium_priority = premium_priority
    where landlord_id = v_old_owner;
  end if;

  if v_new_owner is not null and v_new_owner is distinct from v_old_owner then
    update public.listings
    set premium_priority = premium_priority
    where landlord_id = v_new_owner;
  end if;

  return null;
end;
$function$;

drop trigger if exists trg_refresh_listing_priority_on_subscription on public.landlord_subscriptions;
create trigger trg_refresh_listing_priority_on_subscription
after insert or update or delete on public.landlord_subscriptions
for each row execute function rentnest_private.refresh_listing_priority_on_subscription();

-- Recalculate existing listings once after adding the new fields.
update public.listings
set premium_priority = premium_priority;

revoke all on function rentnest_private.set_listing_priority_fields() from public, anon, authenticated;
revoke all on function rentnest_private.refresh_listing_priority_on_subscription() from public, anon, authenticated;
