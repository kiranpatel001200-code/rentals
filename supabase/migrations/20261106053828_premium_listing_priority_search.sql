-- Return only the currently visible listing IDs that have premium or admin-featured placement.
-- The function exposes no subscription data, only IDs already in the caller's search result.
create or replace function public.get_premium_priority_listing_ids(p_listing_ids uuid[])
returns table(listing_id uuid)
language sql
stable
security definer
set search_path to ''
as $function$
  select l.id
  from public.listings l
  where l.id = any(coalesce(p_listing_ids, array[]::uuid[]))
    and l.status::text = 'approved'
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
$function$;

revoke all on function public.get_premium_priority_listing_ids(uuid[]) from public, anon, authenticated;
grant execute on function public.get_premium_priority_listing_ids(uuid[]) to anon, authenticated;
