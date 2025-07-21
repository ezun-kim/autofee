import Database, { type MeterReading, type MonthlyBill, type UnitBill, type Unit } from '../database/Database';

export class BillCalculator {
  private db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  // 관리비 계산 및 저장
  async calculateAndSaveBills(
    year: number,
    month: number,
    totalElectricityCost: number,
    totalWaterCost: number,
    totalManagementCost: number
  ): Promise<UnitBill[]> {
    // 월별 전체 요금 저장
    const monthlyBill: MonthlyBill = {
      year,
      month,
      total_electricity_cost: totalElectricityCost,
      total_water_cost: totalWaterCost,
      total_management_cost: totalManagementCost
    };
    this.db.saveMonthlyBill(monthlyBill);

    // 모든 호실 정보 가져오기
    const units = this.db.getUnits();
    const currentReadings = this.db.getMeterReadings(year, month);
    
    // 전체 면적 계산
    const totalArea = units.reduce((sum, unit) => sum + unit.area, 0);
    
    // 전체 전기/수도 사용량 계산
    const totalElectricityUsage = this.calculateTotalElectricityUsage(units, currentReadings, year, month);
    const totalWaterUsage = this.calculateTotalWaterUsage(units, currentReadings, year, month);

    const unitBills: UnitBill[] = [];

    // 각 호실별 요금 계산
    for (const unit of units) {
      const currentReading = currentReadings.find(r => r.unit_id === unit.id);
      if (!currentReading) continue;

      const previousReading = this.db.getPreviousMonthReading(unit.id, year, month);
      
      // 전기료 계산 (사용량 비례)
      const electricityUsage = this.calculateElectricityUsage(currentReading, previousReading);
      const electricityCost = totalElectricityUsage > 0 
        ? (electricityUsage / totalElectricityUsage) * totalElectricityCost 
        : 0;

      // 수도료 계산 (사용량 비례)
      const waterUsage = this.calculateWaterUsage(currentReading, previousReading);
      const waterCost = totalWaterUsage > 0 
        ? (waterUsage / totalWaterUsage) * totalWaterCost 
        : 0;

      // 공동관리비 계산 (면적 비례)
      const managementCost = (unit.area / totalArea) * totalManagementCost;

      const unitBill: UnitBill = {
        unit_id: unit.id,
        year,
        month,
        electricity_cost: Math.round(electricityCost),
        water_cost: Math.round(waterCost),
        management_cost: Math.round(managementCost),
        total_cost: Math.round(electricityCost + waterCost + managementCost)
      };

      this.db.saveUnitBill(unitBill);
      unitBills.push(unitBill);
    }

    return unitBills;
  }

  // 전체 전기 사용량 계산
  private calculateTotalElectricityUsage(units: Unit[], currentReadings: MeterReading[], year: number, month: number): number {
    let totalUsage = 0;
    
    for (const unit of units) {
      const currentReading = currentReadings.find(r => r.unit_id === unit.id);
      if (!currentReading) continue;

      const previousReading = this.db.getPreviousMonthReading(unit.id, year, month);
      const usage = this.calculateElectricityUsage(currentReading, previousReading);
      totalUsage += usage;
    }
    
    return totalUsage;
  }

  // 전체 수도 사용량 계산
  private calculateTotalWaterUsage(units: Unit[], currentReadings: MeterReading[], year: number, month: number): number {
    let totalUsage = 0;
    
    for (const unit of units) {
      const currentReading = currentReadings.find(r => r.unit_id === unit.id);
      if (!currentReading) continue;

      const previousReading = this.db.getPreviousMonthReading(unit.id, year, month);
      const usage = this.calculateWaterUsage(currentReading, previousReading);
      totalUsage += usage;
    }
    
    return totalUsage;
  }

  // 개별 호실 전기 사용량 계산
  private calculateElectricityUsage(currentReading: MeterReading, previousReading: MeterReading | null): number {
    if (!previousReading) return 0;
    return Math.max(0, currentReading.electricity_reading - previousReading.electricity_reading);
  }

  // 개별 호실 수도 사용량 계산
  private calculateWaterUsage(currentReading: MeterReading, previousReading: MeterReading | null): number {
    if (!previousReading) return 0;
    return Math.max(0, currentReading.water_reading - previousReading.water_reading);
  }

  // 호실별 사용량 조회 (고지서 출력용)
  getUsageDetails(unitId: string, year: number, month: number) {
    const currentReading = this.db.getMeterReadings(year, month).find(r => r.unit_id === unitId);
    const previousReading = this.db.getPreviousMonthReading(unitId, year, month);
    
    if (!currentReading) return null;

    return {
      currentElectricity: currentReading.electricity_reading,
      previousElectricity: previousReading?.electricity_reading || 0,
      electricityUsage: this.calculateElectricityUsage(currentReading, previousReading),
      currentWater: currentReading.water_reading,
      previousWater: previousReading?.water_reading || 0,
      waterUsage: this.calculateWaterUsage(currentReading, previousReading)
    };
  }
}

export default BillCalculator; 