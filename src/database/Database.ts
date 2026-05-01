import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface Unit {
  id: string;
  name: string;
  area: number;
  password_hash?: string | null;
}

export interface MeterReading {
  id?: number;
  unit_id: string;
  year: number;
  month: number;
  electricity_reading: number;
  water_reading: number;
  created_at?: string;
}

export interface MonthlyBill {
  id?: number;
  year: number;
  month: number;
  total_electricity_cost: number;
  total_water_cost: number;
  total_overall_cost: number;       // 사용자 입력 그랜드 토탈
  total_management_cost: number;    // 파생: total_overall - total_elec - total_water
  created_at?: string;
}

export interface UnitBill {
  id?: number;
  unit_id: string;
  year: number;
  month: number;
  electricity_cost: number;
  water_cost: number;
  management_cost: number;
  total_cost: number;
  created_at?: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

class Database {
  private client: SupabaseClient | null = null;

  async initialize() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error(
        'Supabase 환경변수가 설정되지 않았습니다. .env.local에 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 설정하세요.'
      );
    }
    this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  private get db(): SupabaseClient {
    if (!this.client) throw new Error('Database not initialized');
    return this.client;
  }

  async getUnits(): Promise<Unit[]> {
    const { data, error } = await this.db.from('units').select('*').order('id');
    if (error) throw error;
    return (data ?? []) as Unit[];
  }

  async upsertUnit(unit: Unit): Promise<void> {
    const { error } = await this.db
      .from('units')
      .upsert({ id: unit.id, name: unit.name, area: unit.area });
    if (error) throw error;
  }

  async setUnitPassword(unitId: string, passwordHash: string | null): Promise<void> {
    const { error } = await this.db
      .from('units')
      .update({ password_hash: passwordHash })
      .eq('id', unitId);
    if (error) throw error;
  }

  async deleteUnit(unitId: string): Promise<void> {
    // ON DELETE CASCADE로 meter_readings/unit_bills도 같이 삭제됨
    const { error } = await this.db.from('units').delete().eq('id', unitId);
    if (error) throw error;
  }

  async saveMeterReading(reading: MeterReading): Promise<void> {
    const { error } = await this.db
      .from('meter_readings')
      .upsert(
        {
          unit_id: reading.unit_id,
          year: reading.year,
          month: reading.month,
          electricity_reading: reading.electricity_reading,
          water_reading: reading.water_reading,
        },
        { onConflict: 'unit_id,year,month' }
      );
    if (error) throw error;
  }

  async getMeterReadings(year: number, month: number): Promise<MeterReading[]> {
    const { data, error } = await this.db
      .from('meter_readings')
      .select('*')
      .eq('year', year)
      .eq('month', month);
    if (error) throw error;
    return (data ?? []) as MeterReading[];
  }

  async getAllMeterReadings(): Promise<MeterReading[]> {
    const { data, error } = await this.db
      .from('meter_readings')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false });
    if (error) throw error;
    return (data ?? []) as MeterReading[];
  }

  async getAllMonthlyBills(): Promise<MonthlyBill[]> {
    const { data, error } = await this.db.from('monthly_bills').select('*');
    if (error) throw error;
    return (data ?? []) as MonthlyBill[];
  }

  async getAllUnitBills(): Promise<UnitBill[]> {
    const { data, error } = await this.db.from('unit_bills').select('*');
    if (error) throw error;
    return (data ?? []) as UnitBill[];
  }

  async getPreviousMonthReading(
    unitId: string,
    year: number,
    month: number
  ): Promise<MeterReading | null> {
    let prevYear = year;
    let prevMonth = month - 1;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = year - 1;
    }
    const { data, error } = await this.db
      .from('meter_readings')
      .select('*')
      .eq('unit_id', unitId)
      .eq('year', prevYear)
      .eq('month', prevMonth)
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as MeterReading | null;
  }

  async saveMonthlyBill(bill: MonthlyBill): Promise<void> {
    const { error } = await this.db
      .from('monthly_bills')
      .upsert(
        {
          year: bill.year,
          month: bill.month,
          total_electricity_cost: bill.total_electricity_cost,
          total_water_cost: bill.total_water_cost,
          total_overall_cost: bill.total_overall_cost,
          total_management_cost: bill.total_management_cost,
        },
        { onConflict: 'year,month' }
      );
    if (error) throw error;
  }

  async getSetting(key: string): Promise<string | null> {
    const { data, error } = await this.db
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (error) throw error;
    return data?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    const { error } = await this.db
      .from('app_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
  }

  async getMonthlyBill(year: number, month: number): Promise<MonthlyBill | null> {
    const { data, error } = await this.db
      .from('monthly_bills')
      .select('*')
      .eq('year', year)
      .eq('month', month)
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as MonthlyBill | null;
  }

  async saveUnitBill(bill: UnitBill): Promise<void> {
    const { error } = await this.db
      .from('unit_bills')
      .upsert(
        {
          unit_id: bill.unit_id,
          year: bill.year,
          month: bill.month,
          electricity_cost: bill.electricity_cost,
          water_cost: bill.water_cost,
          management_cost: bill.management_cost,
          total_cost: bill.total_cost,
        },
        { onConflict: 'unit_id,year,month' }
      );
    if (error) throw error;
  }

  async getUnitBills(year: number, month: number): Promise<UnitBill[]> {
    const { data, error } = await this.db
      .from('unit_bills')
      .select('*')
      .eq('year', year)
      .eq('month', month);
    if (error) throw error;
    return (data ?? []) as UnitBill[];
  }
}

export default Database;
