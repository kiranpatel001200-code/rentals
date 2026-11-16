-- Prevent duplicate pending PayPal checkouts for the same listing.
create unique index if not exists listing_premium_orders_one_pending_per_listing
on public.listing_premium_orders(listing_id)
where status = 'pending';

-- Serialize activation per listing and reject any second active paid promotion.
create or replace function public.activate_listing_premium_payment(
  p_order_id text,
  p_capture_id text,
  p_amount numeric
)
returns timestamptz
language plpgsql
security definer
set search_path to ''
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

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_order.listing_id::text, 0)
  );

  if v_order.amount <> p_amount or v_order.currency <> 'USD' then
    raise exception 'The captured payment does not match the Listing Premium order.';
  end if;

  if v_order.status = 'completed' then
    if v_order.paypal_capture_id <> p_capture_id then
      raise exception 'This order has already been completed with a different capture.';
    end if;
    return v_order.expires_at;
  end if;
  if v_order.status <> 'pending' then
    raise exception 'This Listing Premium order is no longer pending.';
  end if;

  if exists (
    select 1 from public.listing_premium_orders o
    where o.listing_id = v_order.listing_id
      and o.id <> v_order.id
      and o.status = 'completed'
      and o.expires_at > now()
  ) then
    raise exception 'This listing already has active Listing Premium.';
  end if;

  if not exists (
    select 1 from public.listings l
    where l.id = v_order.listing_id
      and l.landlord_id = v_order.user_id
      and l.status::text = 'approved'
      and l.deleted_at is null
  ) then
    raise exception 'Only your live listing can be upgraded.';
  end if;

  v_expiry := now() + pg_catalog.make_interval(days => v_order.term_days);

  update public.listing_premium_orders
  set status = 'completed',
      paypal_capture_id = p_capture_id,
      completed_at = now(),
      expires_at = v_expiry,
      updated_at = now()
  where id = v_order.id;

  update public.listings
  set premium_priority = premium_priority
  where id = v_order.listing_id;

  return v_expiry;
end;
$function$;

revoke all on function public.activate_listing_premium_payment(text,text,numeric) from public, anon, authenticated;
grant execute on function public.activate_listing_premium_payment(text,text,numeric) to service_role;
