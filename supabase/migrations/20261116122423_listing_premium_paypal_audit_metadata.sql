alter table public.listing_premium_orders
  add column if not exists paypal_payer_id text,
  add column if not exists payer_name text,
  add column if not exists payer_email text,
  add column if not exists payment_method text,
  add column if not exists card_brand text,
  add column if not exists card_last4 text,
  add column if not exists paypal_fee_amount numeric(10,2),
  add column if not exists paypal_net_amount numeric(10,2),
  add column if not exists paypal_environment text;
