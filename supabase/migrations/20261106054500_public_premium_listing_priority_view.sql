-- Expose only IDs of approved, public listings with premium/featured ranking.
-- This is safe to read publicly because each result is already a public listing ID;
-- no landlord identity, payment, or subscription fields are exposed.
create or replace view public.premium_listing_priorities
with (security_barrier = true)
as
select l.id as listing_id
from public.listings l
where l.status::text = 'approved'
  and l.deleted_at is null
  and not rentnest_private.is_blocked(l.landlord_id)
  and (
    l.is_featured = true
    or exists (
      select 1
      from public.landlord_subscriptions ls
      join public.subscription_plans sp on sp.id = ls.plan_id
      where ls.landlord_id = l.landlord_id
        and ls.status::text in ('active', 'trialing')
        and (ls.current_period_end is null or ls.current_period_end > now())
        and sp.priority_ranking = true
    )
  );

revoke all on public.premium_listing_priorities from public;
grant select on public.premium_listing_priorities to anon, authenticated;

revoke all on function public.get_premium_priority_listing_ids(uuid[]) from public, anon, authenticated;
drop function if exists public.get_premium_priority_listing_ids(uuid[]);
