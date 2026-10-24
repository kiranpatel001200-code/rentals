alter table public.support_requests
  add column if not exists client_submission_id uuid,
  add column if not exists email_notification_status text not null default 'pending',
  add column if not exists email_notification_sent_at timestamptz,
  add column if not exists email_notification_attempts integer not null default 0,
  add column if not exists email_notification_error text,
  add column if not exists email_notification_claimed_at timestamptz;

alter table public.support_requests
  drop constraint if exists support_requests_email_notification_status_check;
alter table public.support_requests
  add constraint support_requests_email_notification_status_check
  check (email_notification_status = any (array['pending','sending','sent','failed']));

alter table public.support_requests
  drop constraint if exists support_requests_email_notification_attempts_check;
alter table public.support_requests
  add constraint support_requests_email_notification_attempts_check
  check (email_notification_attempts >= 0 and email_notification_attempts <= 100);

create unique index if not exists support_requests_client_submission_id_uidx
  on public.support_requests(client_submission_id)
  where client_submission_id is not null;

create index if not exists support_requests_email_notification_status_idx
  on public.support_requests(email_notification_status, created_at desc);

create table if not exists public.contact_form_rate_limits (
  ip_hash text primary key check (ip_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1 check (request_count >= 0),
  updated_at timestamptz not null default now()
);
alter table public.contact_form_rate_limits enable row level security;
revoke all on public.contact_form_rate_limits from public, anon, authenticated;

create or replace function public.consume_contact_form_rate_limit(p_ip_hash text)
returns boolean
language plpgsql
volatile
security definer
set search_path to ''
as $function$
declare
  v_count integer;
  v_window timestamptz;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[a-f0-9]{64}$' then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_ip_hash, 0));

  insert into public.contact_form_rate_limits(ip_hash, window_started_at, request_count, updated_at)
  values (p_ip_hash, now(), 1, now())
  on conflict (ip_hash) do update
    set window_started_at = case
          when public.contact_form_rate_limits.window_started_at < now() - interval '15 minutes'
          then now()
          else public.contact_form_rate_limits.window_started_at
        end,
        request_count = case
          when public.contact_form_rate_limits.window_started_at < now() - interval '15 minutes'
          then 1
          else public.contact_form_rate_limits.request_count + 1
        end,
        updated_at = now()
  returning request_count, window_started_at into v_count, v_window;

  delete from public.contact_form_rate_limits
  where updated_at < now() - interval '24 hours';

  return v_count <= 5;
end;
$function$;

revoke all on function public.consume_contact_form_rate_limit(text) from public, anon, authenticated;
grant execute on function public.consume_contact_form_rate_limit(text) to service_role;
