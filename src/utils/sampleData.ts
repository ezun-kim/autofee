import Database, { type MeterReading } from '../database/Database';

// 이미지 데이터를 기반으로 한 샘플 데이터 생성
export const insertSampleData = (database: Database) => {
  try {
    // 1월 검침값 (이전 월 데이터)
    const januaryReadings: MeterReading[] = [
      {
        unit_id: '601A',
        year: 2024,
        month: 1,
        electricity_reading: 1923,
        water_reading: 89.7
      },
      {
        unit_id: '601B',
        year: 2024,
        month: 1,
        electricity_reading: 30635,
        water_reading: 89.7
      }
    ];

    // 2월 검침값 (현재 월 데이터 - 이미지 기준)
    const februaryReadings: MeterReading[] = [
      {
        unit_id: '601A',
        year: 2024,
        month: 2,
        electricity_reading: 2123,  // 200KWH 사용 (2123 - 1923)
        water_reading: 93.36        // 3.66m³ 사용 (93.36 - 89.7)
      },
      {
        unit_id: '601B',
        year: 2024,
        month: 2,
        electricity_reading: 30734, // 99KWH 사용 (30734 - 30635)
        water_reading: 93.36        // 3.66m³ 사용 (93.36 - 89.7)
      }
    ];

    // 검침값 저장
    januaryReadings.forEach(reading => {
      database.saveMeterReading(reading);
    });

    februaryReadings.forEach(reading => {
      database.saveMeterReading(reading);
    });

    console.log('샘플 데이터가 성공적으로 저장되었습니다.');
    return true;
  } catch (error) {
    console.error('샘플 데이터 저장 중 오류 발생:', error);
    return false;
  }
};

// 2월 관리비 계산을 위한 전체 요금 정보 (이미지 기준)
export const getSampleBillData = () => {
  return {
    year: 2024,
    month: 2,
    totalManagementFee: 288510,    // 전체 관리비 (이미지의 관리비 총액)
    totalElectricityCost: 47440,   // 당월 전기료
    totalWaterCost: 17440,         // 당월 수도료
    // 공동관리비는 자동 계산: 288,510 - 47,440 - 17,440 = 223,630
  };
};

export default { insertSampleData, getSampleBillData }; 