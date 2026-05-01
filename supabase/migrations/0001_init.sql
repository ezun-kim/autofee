-- autofee schema: 호실/검침/관리비
-- Supabase SQL Editor에서 한번 실행하세요.

create table if not exists units (
  id text primary key,
  name text not null,
  area double precision not null
);

create table if not exists meter_readings (
  id bigserial primary key,
  unit_id text not null references units(id) on delete cascade,
  year integer not null,
  month integer not null,
  electricity_reading double precision not null,
  water_reading double precision not null,
  created_at timestamptz default now(),
  unique (unit_id, year, month)
);

create table if not exists monthly_bills (
  id bigserial primary key,
  year integer not null,
  month integer not null,
  total_electricity_cost double precision not null,
  total_water_cost double precision not null,
  total_management_cost double precision not null,
  created_at timestamptz default now(),
  unique (year, month)
);

create table if not exists unit_bills (
  id bigserial primary key,
  unit_id text not null references units(id) on delete cascade,
  year integer not null,
  month integer not null,
  electricity_cost double precision not null,
  water_cost double precision not null,
  management_cost double precision not null,
  total_cost double precision not null,
  created_at timestamptz default now(),
  unique (unit_id, year, month)
);

-- 기본 호실 시드
insert into units (id, name, area) values
  ('601A', '601A호', 60.0),
  ('601B', '601B호', 120.0)
on conflict (id) do nothing;

-- RLS: 익명 키로 읽기/쓰기 허용 (소규모 사적 앱 가정).
-- 보안이 필요하면 Supabase Auth로 전환 후 정책을 사용자 ID 기반으로 좁힐 것.
alter table units enable row level security;
alter table meter_readings enable row level security;
alter table monthly_bills enable row level security;
alter table unit_bills enable row level security;

create policy "anon all" on units        for all to anon using (true) with check (true);
create policy "anon all" on meter_readings for all to anon using (true) with check (true);
create policy "anon all" on monthly_bills  for all to anon using (true) with check (true);
create policy "anon all" on unit_bills     for all to anon using (true) with check (true);
