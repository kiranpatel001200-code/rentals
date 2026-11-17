alter table public.pass_payments
  add column if not exists paypal_capture_id text,
  add column if not exists paypal_payer_id text,
  add column if not exists payer_name text,
  add column if not exists payer_email text,
  add column if not exists payment_method text not null default 'unknown',
  add column if not exists card_brand text,
  add column if not exists card_last4 text,
  add column if not exists paypal_fee_amount numeric,
  add column if not exists paypal_net_amount numeric,
  add column if not exists paypal_environment text,
  add column if not exists account_role text;

alter table public.payments
  add column if not exists account_role text,
  add column if not exists paypal_environment text;

alter table public.listing_premium_orders
  add column if not exists account_role text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pass_payments_method_check') then
    alter table public.pass_payments add constraint pass_payments_method_check
      check (payment_method in ('card','paypal','unknown'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pass_payments_card_last4_check') then
    alter table public.pass_payments add constraint pass_payments_card_last4_check
      check (card_last4 is null or card_last4 ~ '^[0-9]{2,4}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pass_payments_environment_check') then
    alter table public.pass_payments add constraint pass_payments_environment_check
      check (paypal_environment is null or paypal_environment in ('sandbox','live'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pass_payments_account_role_check') then
    alter table public.pass_payments add constraint pass_payments_account_role_check
      check (account_role is null or account_role in ('renter','landlord'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payments_account_role_check') then
    alter table public.payments add constraint payments_account_role_check
      check (account_role is null or account_role in ('renter','landlord'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payments_environment_check') then
    alter table public.payments add constraint payments_environment_check
      check (paypal_environment is null or paypal_environment in ('sandbox','live'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'listing_premium_orders_account_role_check') then
    alter table public.listing_premium_orders add constraint listing_premium_orders_account_role_check
      check (account_role is null or account_role in ('renter','landlord'));
  end if;
end $$;

create unique index if not exists pass_payments_paypal_capture_id_key
  on public.pass_payments(paypal_capture_id) where paypal_capture_id is not null;
create index if not exists pass_payments_created_at_desc_idx
  on public.pass_payments(created_at desc);
