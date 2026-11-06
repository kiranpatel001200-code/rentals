-- One message per renter per listing, for good.
-- Before: prepare_inquiry only stopped a repeat within 24 hours, so a renter could message the same listing again the next day.
-- Now: any second message to the same listing is refused, and a unique index backs this up
-- (it also stops two taps in the same moment from creating two messages).
-- Checked on 2026-11-06: 7 messages in the table, no renter had written to the same listing twice, so the index can be created safely.

create unique index if not exists inquiries_one_per_renter_listing
  on public.inquiries (renter_id, listing_id);

create or replace function public.prepare_inquiry()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare l record; n int;
begin
  select id, landlord_id, status into l from public.listings where id = new.listing_id;
  if not found or l.status <> 'approved' or public.is_blocked(l.landlord_id) then raise exception 'This listing is not available.'; end if;
  if l.landlord_id = new.renter_id then raise exception 'You cannot message your own listing.'; end if;
  if exists (select 1 from public.inquiries where renter_id = new.renter_id and listing_id = new.listing_id) then
    raise exception 'You already sent a message about this listing. You can read it in Messages.';
  end if;
  select count(*) into n from public.inquiries where renter_id = new.renter_id and created_at > now() - interval '24 hours';
  if n >= 20 then raise exception 'You reached the daily limit of messages. Please try again tomorrow.'; end if;
  new.landlord_id := l.landlord_id;
  return new;
end;
$function$;
