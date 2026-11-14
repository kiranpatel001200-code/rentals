update public.subscription_plans
set is_verified_badge_included = false,
    features = '["Priority placement in matching rental searches","Unlimited active listings while Premium is active","Featured visibility for eligible listings","Verified-email renter enquiry indicators","Messages inbox for renter enquiries and viewing requests"]'::jsonb
where slug = 'landlord-premium-yearly';
