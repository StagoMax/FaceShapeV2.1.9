-- Create client log table for lightweight telemetry
create table if not exists public.app_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  level text not null default 'info',
  event text not null,
  user_id uuid null,
  context jsonb not null default '{}'::jsonb
);

alter table public.app_logs enable row level security;

drop policy if exists "Allow insert app logs" on public.app_logs;
create policy "Allow insert app logs" on public.app_logs
  for insert
  to anon, authenticated
  with check (true);
