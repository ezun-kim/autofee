-- 1. monthly_bills: add total_overall_cost (grand total user enters)
--    total_management_cost becomes derived common-shared (= overall - elec - water)
alter table monthly_bills add column if not exists total_overall_cost double precision;

-- Backfill: existing total_management_cost values were entered as grand totals
update monthly_bills set total_overall_cost = total_management_cost where total_overall_cost is null;

-- Now recompute total_management_cost as derived common-shared
update monthly_bills
set total_management_cost = greatest(0, total_overall_cost - total_electricity_cost - total_water_cost);

alter table monthly_bills alter column total_overall_cost set not null;

-- 2. app_settings table (admin password etc.)
create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

alter table app_settings enable row level security;
create policy "anon all" on app_settings for all to anon using (true) with check (true);

-- Default admin password hash = sha256('aut12131!')
insert into app_settings (key, value) values
  ('admin_password_hash', 'bbd6962637c46cedfae236030cfed86a3d50c8bc72eeaa3977ec6163c91500d8')
on conflict (key) do nothing;
