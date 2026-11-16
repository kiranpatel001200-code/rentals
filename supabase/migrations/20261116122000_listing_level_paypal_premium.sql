-- Listing-level Listing Premium purchases.
-- Independent of the renter Contact Pass and the landlord account subscription.
create table if not exists public.listing_premium_orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  paypal_order_id text not null unique,
  paypal_capture_id text unique,
  amount numeric(10,2) not null check (amount > 0),
  currency text not null default 'USD' check (currency = 'USD'),
  status text not null default 'pending'
    check (status in ('pending','completed','failed','cancelled','refunded')),
  term_days integer not null default 365 check (term_days between 1 and 365),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint listing_premium_order_completed_fields check (
    status <> 'completed' or (paypal_capture_id is not null and completed_at is not null and expires_at is not null)
  )
);

create index if not exists listing_premium_orders_listing_active_idx
  on public.listing_premium_orders(listing_id, expires_at desc)
  where status = 'completed';
create index if not exists listing_premium_orders_user_created_idx
  on public.listing_premium_orders(user_id, created_at desc);

alter table public.listing_premium_orders enable row level security;
revoke all on table public.listing_premium_orders from public, anon, authenticated;
grant select on table public.listing_premium_orders to authenticated;
drop policy if exists "Owners and admins read listing Premium orders" on public.listing_premium_orders;
create policy "Owners and admins read listing Premium orders"
on public.listing_premium_orders for select to authenticated
using (user_id = (select auth.uid()) or public.is_admin((select auth.uid())));

create or replace function public.activate_listing_premium_payment(
  p_order_id text, p_capture_id text, p_amount numeric
)
returns timestamptz
language plpgsql security definer set search_path to ''
as $function$
declare
  v_order public.listing_premium_orders%rowtype;
  v_expiry timestamptz;
begin
  if coalesce(trim(p_order_id), '') = ''
     or coalesce(trim(p_capture_id), '') = ''
     or p_amount is null or p_amount <= 0 then
    raise exception 'Invalid Listing Premium payment details.';
  end if;
  select * into v_order
  from public.listing_premium_orders
  where paypal_order_id = p_order_id
  for update;
  if not found then raise exception 'The Listing Premium order was not found.'; end if;
  if v_order.amount <> p_amount or v_order.currency <> 'USD' then
    raise exception 'The captured payment does not match the Listing Premium order.';
  end if;
  if v_order.status = 'completed' then
    if v_order.paypal_capture_id <> p_capture_id then
      raise exception 'This order has already been completed with a different capture.';
    end if;
    return v_order.expires_at;
  end if;
  if v_order.status <> 'pending' then raise exception 'This Listing Premium order is no longer pending.'; end if;
  if not exists (
    select 1 from public.listings l
    where l.id = v_order.listing_id and l.landlord_id = v_order.user_id
      and l.status::text = 'approved' and l.deleted_at is null
  ) then raise exception 'Only your live listing can be upgraded.'; end if;
  v_expiry := now() + pg_catalog.make_interval(days => v_order.term_days);
  update public.listing_premium_orders
  set status = 'completed', paypal_capture_id = p_capture_id,
      completed_at = now(), expires_at = v_expiry, updated_at = now()
  where id = v_order.id;
  update public.listings set premium_priority = premium_priority where id = v_order.listing_id;
  return v_expiry;
end;
$function$;

revoke all on function public.activate_listing_premium_payment(text,text,numeric) from public, anon, authenticated;
grant execute on function public.activate_listing_premium_payment(text,text,numeric) to service_role;

create or replace function rentnest_private.set_listing_priority_fields()
returns trigger language plpgsql security definer set search_path to ''
as $function$
declare
  v_has_priority boolean := false;
  v_has_indefinite boolean := false;
  v_until timestamptz;
begin
  if coalesce(new.is_featured, false) then
    new.premium_priority := true;
    new.premium_priority_until := null;
    return new;
  end if;
  select coalesce(bool_or(active_period.ends_at is null), false),
         max(active_period.ends_at), count(*) > 0
  into v_has_indefinite, v_until, v_has_priority
  from (
    select ls.current_period_end as ends_at
    from public.landlord_subscriptions ls
    join public.subscription_plans sp on sp.id = ls.plan_id
    where ls.landlord_id = new.landlord_id
      and ls.status::text in ('active','trialing')
      and (ls.current_period_end is null or ls.current_period_end > now())
      and sp.priority_ranking = true
    union all
    select o.expires_at as ends_at
    from public.listing_premium_orders o
    where o.listing_id = new.id and o.user_id = new.landlord_id
      and o.status = 'completed' and o.expires_at > now()
    union all
    select g.expires_at as ends_at
    from public.admin_listing_premium_grants g
    where g.listing_id = new.id and g.expires_at > now()
  ) active_period;
  if v_has_priority then
    new.premium_priority := true;
    new.premium_priority_until := case when v_has_indefinite then null else v_until end;
  else
    new.premium_priority := false;
    new.premium_priority_until := null;
  end if;
  return new;
end;
$function$;
revoke all on function rentnest_private.set_listing_priority_fields() from public, anon, authenticated;

create or replace view public.premium_listing_priorities
with (security_barrier = true, security_invoker = true)
as
select l.id as listing_id
from public.listings l
where l.status::text = 'approved' and l.deleted_at is null
  and l.premium_priority = true
  and (l.premium_priority_until is null or l.premium_priority_until > now());
revoke all on public.premium_listing_priorities from public;
grant select on public.premium_listing_priorities to anon, authenticated;

create or replace function public.get_premium_priority_listing_ids(p_listing_ids uuid[])
returns table(listing_id uuid)
language sql stable security invoker set search_path to ''
as $function$
  select l.id
  from public.listings l
  where l.id = any(coalesce(p_listing_ids, array[]::uuid[]))
    and l.status::text = 'approved' and l.deleted_at is null
    and l.premium_priority = true
    and (l.premium_priority_until is null or l.premium_priority_until > now());
$function$;
revoke all on function public.get_premium_priority_listing_ids(uuid[]) from public;
grant execute on function public.get_premium_priority_listing_ids(uuid[]) to anon, authenticated;
update public.listings set premium_priority = premium_priority;
