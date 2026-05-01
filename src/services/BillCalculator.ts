import Database, { type MeterReading, type UnitBill, type Unit } from '../database/Database';

export class BillCalculator {
  private db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  async calculateAndSaveBills(
    year: number,
    month: number,
    totalElectricityCost: number,
    totalWaterCost: number,
    totalManagementCost: number
  ): Promise<UnitBill[]> {
    const units = await this.db.getUnits();
    const currentReadings = await this.db.getMeterReadings(year, month);

    const totalArea = units.reduce((sum, unit) => sum + unit.area, 0);

    const totalElectricityUsage = await this.calculateTotalElectricityUsage(units, currentReadings, year, month);
    const totalWaterUsage = await this.calculateTotalWaterUsage(units, currentReadings, year, month);

    const unitBills: UnitBill[] = [];

    for (const unit of units) {
      const currentReading = currentReadings.find(r => r.unit_id === unit.id);
      if (!currentReading) continue;

      const previousReading = await this.db.getPreviousMonthReading(unit.id, year, month);

      const electricityUsage = this.calculateElectricityUsage(currentReading, previousReading);
      const electricityCost = totalElectricityUsage > 0
        ? (electricityUsage / totalElectricityUsage) * totalElectricityCost
        : 0;

      const waterUsage = this.calculateWaterUsage(currentReading, previousReading);
      const waterCost = totalWaterUsage > 0
        ? (waterUsage / totalWaterUsage) * totalWaterCost
        : 0;

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

      await this.db.saveUnitBill(unitBill);
      unitBills.push(unitBill);
    }

    return unitBills;
  }

  private async calculateTotalElectricityUsage(units: Unit[], currentReadings: MeterReading[], year: number, month: number): Promise<number> {
    let totalUsage = 0;
    for (const unit of units) {
      const currentReading = currentReadings.find(r => r.unit_id === unit.id);
      if (!currentReading) continue;
      const previousReading = await this.db.getPreviousMonthReading(unit.id, year, month);
      totalUsage += this.calculateElectricityUsage(currentReading, previousReading);
    }
    return totalUsage;
  }

  private async calculateTotalWaterUsage(units: Unit[], currentReadings: MeterReading[], year: number, month: number): Promise<number> {
    let totalUsage = 0;
    for (const unit of units) {
      const currentReading = currentReadings.find(r => r.unit_id === unit.id);
      if (!currentReading) continue;
      const previousReading = await this.db.getPreviousMonthReading(unit.id, year, month);
      totalUsage += this.calculateWaterUsage(currentReading, previousReading);
    }
    return totalUsage;
  }

  private calculateElectricityUsage(currentReading: MeterReading, previousReading: MeterReading | null): number {
    if (!previousReading) return 0;
    return Math.max(0, currentReading.electricity_reading - previousReading.electricity_reading);
  }

  private calculateWaterUsage(currentReading: MeterReading, previousReading: MeterReading | null): number {
    if (!previousReading) return 0;
    return Math.max(0, currentReading.water_reading - previousReading.water_reading);
  }

  async getUsageDetails(unitId: string, year: number, month: number) {
    const readings = await this.db.getMeterReadings(year, month);
    const currentReading = readings.find(r => r.unit_id === unitId);
    const previousReading = await this.db.getPreviousMonthReading(unitId, year, month);

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
