alter table public.subscription_plans add column if not exists price_yearly numeric(10,2), add column if not exists billing_interval text not null default 'month';
do $$ begin
 if not exists(select 1 from pg_constraint where conname='subscription_plans_billing_interval_check' and conrelid='public.subscription_plans'::regclass) then
  alter table public.subscription_plans add constraint subscription_plans_billing_interval_check check(billing_interval in ('month','year'));
 end if;
 if not exists(select 1 from pg_constraint where conname='subscription_plans_price_yearly_check' and conrelid='public.subscription_plans'::regclass) then
  alter table public.subscription_plans add constraint subscription_plans_price_yearly_check check(price_yearly is null or price_yearly>=0);
 end if;
end $$;
insert into public.subscription_plans(slug,name,price_monthly,price_yearly,billing_interval,max_listings,is_featured_included,is_verified_badge_included,priority_ranking,features)
values('landlord-premium-yearly','Landlord Premium (Annual)',0,35.00,'year',null,true,true,true,'["Unlimited active listings","Priority search placement","Featured listing visibility","Verified landlord badge","Advanced listing analytics"]'::jsonb)
on conflict(slug) do update set name=excluded.name,price_monthly=excluded.price_monthly,price_yearly=excluded.price_yearly,billing_interval=excluded.billing_interval,max_listings=excluded.max_listings,is_featured_included=excluded.is_featured_included,is_verified_badge_included=excluded.is_verified_badge_included,priority_ranking=excluded.priority_ranking,features=excluded.features;
create or replace function public.enforce_listing_limit() returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare v_max_listings integer; v_current_count integer;
begin
 if tg_op='UPDATE' and (old.deleted_at is null or new.deleted_at is not null) then return new; end if;
 select sp.max_listings into v_max_listings from public.landlord_subscriptions ls join public.subscription_plans sp on sp.id=ls.plan_id
 where ls.landlord_id=new.landlord_id and ls.status::text in('active','trialing') and (ls.current_period_end is null or ls.current_period_end>now())
 order by ls.current_period_start desc limit 1;
 if not found then select max_listings into v_max_listings from public.subscription_plans where slug='free'; end if;
 if v_max_listings is not null and new.status::text<>'rejected' then
  select count(*) into v_current_count from public.listings where landlord_id=new.landlord_id and status::text<>'rejected' and deleted_at is null;
  if v_current_count>=v_max_listings then raise exception 'Listing limit reached for your current plan (% listings). Upgrade to Premium for more listings.',v_max_listings; end if;
 end if; return new;
end; $function$;
create or replace function public.activate_landlord_premium_payment(p_user_id uuid,p_order_id text,p_capture_id text,p_amount numeric)
returns uuid language plpgsql security definer set search_path to '' as $function$
declare v_payment public.payments%rowtype; v_plan_id uuid; v_subscription_id uuid; v_now timestamptz:=now();
begin
 if p_user_id is null or coalesce(trim(p_order_id),'')='' or coalesce(trim(p_capture_id),'')='' or p_amount<>35.00 then raise exception 'Invalid Landlord Premium payment details.'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
 if not exists(select 1 from public.profiles p join auth.users u on u.id=p.id where p.id=p_user_id and p.role::text='landlord' and p.is_banned=false and u.email_confirmed_at is not null) then raise exception 'A verified, active landlord account is required.'; end if;
 select id into v_plan_id from public.subscription_plans where slug='landlord-premium-yearly' and billing_interval='year' and price_yearly=35.00 limit 1;
 if v_plan_id is null then raise exception 'The annual Landlord Premium plan is not configured.'; end if;
 select * into v_payment from public.payments where paypal_order_id=p_order_id for update;
 if not found or v_payment.user_id<>p_user_id or v_payment.payment_type::text<>'subscription' or v_payment.amount<>35.00 or v_payment.currency<>'USD' then raise exception 'The pending payment does not match this landlord account.'; end if;
 if v_payment.status::text='completed' then if v_payment.subscription_id is null then raise exception 'The completed payment is missing its subscription record.'; end if; return v_payment.subscription_id; end if;
 if v_payment.status::text<>'pending' then raise exception 'This payment is no longer pending.'; end if;
 select id into v_subscription_id from public.landlord_subscriptions where landlord_id=p_user_id and plan_id=v_plan_id and status::text in('active','trialing') and (current_period_end is null or current_period_end>v_now) order by current_period_start desc limit 1 for update;
 if v_subscription_id is not null then update public.landlord_subscriptions set status='active',current_period_end=greatest(coalesce(current_period_end,v_now),v_now)+interval '1 year',cancel_at_period_end=false where id=v_subscription_id;
 else insert into public.landlord_subscriptions(landlord_id,plan_id,status,current_period_start,current_period_end,cancel_at_period_end) values(p_user_id,v_plan_id,'active',v_now,v_now+interval '1 year',false) returning id into v_subscription_id; end if;
 update public.payments set subscription_id=v_subscription_id,paypal_capture_id=p_capture_id,amount=35.00,currency='USD',status='completed',failure_reason=null where id=v_payment.id; return v_subscription_id;
end; $function$;
revoke all on function public.activate_landlord_premium_payment(uuid,text,text,numeric) from public,anon,authenticated;
grant execute on function public.activate_landlord_premium_payment(uuid,text,text,numeric) to service_role;