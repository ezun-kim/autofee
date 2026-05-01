-- Fix: 0003 migration assumed old total_management_cost was the grand total.
-- Actually it was the common-shared mgmt fee. Restore + recompute total_overall_cost.
--
-- Before this fix:
--   total_overall_cost  = ORIGINAL total_management_cost (assumed grand total)
--   total_management_cost = ORIGINAL - elec - water (corrupted)
--
-- After:
--   total_management_cost = ORIGINAL (the actual common-shared)
--   total_overall_cost    = ORIGINAL + elec + water (the real grand total)

update monthly_bills set
  total_management_cost = total_overall_cost,
  total_overall_cost    = total_overall_cost + total_electricity_cost + total_water_cost;

-- Recompute all unit_bills using the corrected total_management_cost (= common-shared mgmt fee).
-- Replicates BillCalculator logic in SQL: area-proportional management, usage-proportional elec/water.
with
  ta as (select sum(area) as total_area from units),
  rd as (
    select
      mr.unit_id, mr.year, mr.month,
      mr.electricity_reading, mr.water_reading,
      lag(mr.electricity_reading) over (partition by mr.unit_id order by mr.year, mr.month) as prev_elec,
      lag(mr.water_reading)       over (partition by mr.unit_id order by mr.year, mr.month) as prev_water
    from meter_readings mr
  ),
  usage as (
    select
      unit_id, year, month,
      greatest(0, electricity_reading - coalesce(prev_elec,  electricity_reading)) as elec_use,
      greatest(0, water_reading       - coalesce(prev_water, water_reading))       as water_use
    from rd
  ),
  mt as (
    select year, month,
      sum(elec_use)  as sum_elec_use,
      sum(water_use) as sum_water_use
    from usage
    group by year, month
  ),
  calc as (
    select
      u.id as unit_id,
      mb.year, mb.month,
      case when mt.sum_elec_use > 0
           then usage.elec_use::float / mt.sum_elec_use * mb.total_electricity_cost
           else 0 end as electricity_cost,
      case when mt.sum_water_use > 0
           then usage.water_use::float / mt.sum_water_use * mb.total_water_cost
           else 0 end as water_cost,
      u.area::float / ta.total_area * mb.total_management_cost as management_cost
    from monthly_bills mb
    join usage on usage.year = mb.year and usage.month = mb.month
    join units u on u.id = usage.unit_id
    join mt on mt.year = mb.year and mt.month = mb.month
    cross join ta
  )
insert into unit_bills (unit_id, year, month, electricity_cost, water_cost, management_cost, total_cost)
select
  unit_id, year, month,
  round(electricity_cost) as electricity_cost,
  round(water_cost)       as water_cost,
  round(management_cost)  as management_cost,
  round(electricity_cost + water_cost + management_cost) as total_cost
from calc
on conflict (unit_id, year, month) do update set
  electricity_cost = excluded.electricity_cost,
  water_cost       = excluded.water_cost,
  management_cost  = excluded.management_cost,
  total_cost       = excluded.total_cost;
