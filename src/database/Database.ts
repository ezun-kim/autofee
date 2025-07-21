import initSqlJs, { type Database as SqlDatabase } from 'sql.js';

export interface Unit {
  id: string;
  name: string;
  area: number; // 면적 (m²)
}

export interface MeterReading {
  id?: number;
  unit_id: string;
  year: number;
  month: number;
  electricity_reading: number; // KWH
  water_reading: number; // m³
  created_at?: string;
}

export interface MonthlyBill {
  id?: number;
  year: number;
  month: number;
  total_electricity_cost: number;
  total_water_cost: number;
  total_management_cost: number;
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

class Database {
  private db: SqlDatabase | null = null;

  async initialize() {
    try {
      console.log('Database 초기화 시작...');
      const SQL = await initSqlJs({
        locateFile: (file: string) => {
          console.log('SQL.js 파일 로드 시도:', file);
          return `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/${file}`;
        }
      });
      console.log('SQL.js 로드 완료');
      
      this.db = new SQL.Database();
      console.log('Database 인스턴스 생성 완료');
      
      this.createTables();
      console.log('테이블 생성 완료');
      
      this.insertDefaultData();
      console.log('기본 데이터 삽입 완료');
      
      console.log('Database 초기화 성공!');
    } catch (error) {
      console.error('Database 초기화 오류:', error);
      throw error;
    }
  }

  private createTables() {
    if (!this.db) throw new Error('Database not initialized');
    
    // 호실 정보 테이블
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS units (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        area REAL NOT NULL
      )
    `);

    // 검침 정보 테이블
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meter_readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        unit_id TEXT NOT NULL,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        electricity_reading REAL NOT NULL,
        water_reading REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (unit_id) REFERENCES units (id),
        UNIQUE(unit_id, year, month)
      )
    `);

    // 월별 전체 요금 테이블
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS monthly_bills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        total_electricity_cost REAL NOT NULL,
        total_water_cost REAL NOT NULL,
        total_management_cost REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(year, month)
      )
    `);

    // 호실별 청구서 테이블
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS unit_bills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        unit_id TEXT NOT NULL,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        electricity_cost REAL NOT NULL,
        water_cost REAL NOT NULL,
        management_cost REAL NOT NULL,
        total_cost REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (unit_id) REFERENCES units (id),
        UNIQUE(unit_id, year, month)
      )
    `);
  }

  private insertDefaultData() {
    if (!this.db) throw new Error('Database not initialized');
    
    // 기본 호실 정보 삽입 (이미지 기준으로 면적 비율 계산)
    // 601A: 약 33%, 601B: 약 67% 비율로 추정 (이미지의 관리비 비율 기반)
    this.db.exec(`
      INSERT OR REPLACE INTO units (id, name, area) VALUES 
      ('601A', '601A호', 60.0),
      ('601B', '601B호', 120.0)
    `);
  }

  // 검침값 저장
  saveMeterReading(reading: MeterReading) {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO meter_readings 
      (unit_id, year, month, electricity_reading, water_reading) 
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run([reading.unit_id, reading.year, reading.month, reading.electricity_reading, reading.water_reading]);
    stmt.free();
    this.autoSave(); // 자동 저장
  }

  // 월별 전체 요금 저장
  saveMonthlyBill(bill: MonthlyBill) {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO monthly_bills 
      (year, month, total_electricity_cost, total_water_cost, total_management_cost) 
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run([bill.year, bill.month, bill.total_electricity_cost, bill.total_water_cost, bill.total_management_cost]);
    stmt.free();
    this.autoSave(); // 자동 저장
  }

  // 호실별 청구서 저장
  saveUnitBill(bill: UnitBill) {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO unit_bills 
      (unit_id, year, month, electricity_cost, water_cost, management_cost, total_cost) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run([bill.unit_id, bill.year, bill.month, bill.electricity_cost, bill.water_cost, bill.management_cost, bill.total_cost]);
    stmt.free();
    this.autoSave(); // 자동 저장
  }

  // 모든 호실 조회
  getUnits(): Unit[] {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare('SELECT * FROM units ORDER BY id');
    const results: Unit[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        id: row.id as string,
        name: row.name as string,
        area: row.area as number
      });
    }
    stmt.free();
    return results;
  }

  // 특정 월의 검침값 조회
  getMeterReadings(year: number, month: number): MeterReading[] {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare('SELECT * FROM meter_readings WHERE year = ? AND month = ?');
    const results: MeterReading[] = [];
    stmt.bind([year, month]);
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        id: row.id as number,
        unit_id: row.unit_id as string,
        year: row.year as number,
        month: row.month as number,
        electricity_reading: row.electricity_reading as number,
        water_reading: row.water_reading as number,
        created_at: row.created_at as string
      });
    }
    stmt.free();
    return results;
  }

  // 이전 월 검침값 조회
  getPreviousMonthReading(unitId: string, year: number, month: number): MeterReading | null {
    if (!this.db) throw new Error('Database not initialized');
    
    let prevYear = year;
    let prevMonth = month - 1;
    
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = year - 1;
    }

    const stmt = this.db.prepare('SELECT * FROM meter_readings WHERE unit_id = ? AND year = ? AND month = ?');
    stmt.bind([unitId, prevYear, prevMonth]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return {
        id: row.id as number,
        unit_id: row.unit_id as string,
        year: row.year as number,
        month: row.month as number,
        electricity_reading: row.electricity_reading as number,
        water_reading: row.water_reading as number,
        created_at: row.created_at as string
      };
    }
    stmt.free();
    return null;
  }

  // 월별 전체 요금 조회
  getMonthlyBill(year: number, month: number): MonthlyBill | null {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare('SELECT * FROM monthly_bills WHERE year = ? AND month = ?');
    stmt.bind([year, month]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return {
        id: row.id as number,
        year: row.year as number,
        month: row.month as number,
        total_electricity_cost: row.total_electricity_cost as number,
        total_water_cost: row.total_water_cost as number,
        total_management_cost: row.total_management_cost as number,
        created_at: row.created_at as string
      };
    }
    stmt.free();
    return null;
  }

  // 호실별 청구서 조회
  getUnitBills(year: number, month: number): UnitBill[] {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare('SELECT * FROM unit_bills WHERE year = ? AND month = ?');
    const results: UnitBill[] = [];
    stmt.bind([year, month]);
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        id: row.id as number,
        unit_id: row.unit_id as string,
        year: row.year as number,
        month: row.month as number,
        electricity_cost: row.electricity_cost as number,
        water_cost: row.water_cost as number,
        management_cost: row.management_cost as number,
        total_cost: row.total_cost as number,
        created_at: row.created_at as string
      });
    }
    stmt.free();
    return results;
  }

  // 데이터베이스를 로컬스토리지에 저장
  saveToLocalStorage(key: string = 'autofee_database') {
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      const data = this.db.export();
      const base64Data = btoa(String.fromCharCode.apply(null, Array.from(data)));
      localStorage.setItem(key, base64Data);
      console.log('데이터베이스가 로컬스토리지에 저장되었습니다.');
      return true;
    } catch (error) {
      console.error('로컬스토리지 저장 오류:', error);
      return false;
    }
  }

  // 로컬스토리지에서 데이터베이스 로드
  async loadFromLocalStorage(key: string = 'autofee_database') {
    try {
      const base64Data = localStorage.getItem(key);
      if (!base64Data) {
        console.log('로컬스토리지에 저장된 데이터베이스가 없습니다.');
        return false;
      }

      const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      
      const SQL = await initSqlJs({
        locateFile: (file: string) => {
          console.log('SQL.js 파일 로드 시도:', file);
          return `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/${file}`;
        }
      });

      this.db = new SQL.Database(binaryData);
      console.log('로컬스토리지에서 데이터베이스를 로드했습니다.');
      return true;
    } catch (error) {
      console.error('로컬스토리지 로드 오류:', error);
      return false;
    }
  }

  // 데이터베이스를 파일로 다운로드
  exportToFile(filename: string = 'autofee_backup.db') {
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      const data = this.db.export();
      const blob = new Blob([data], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log('데이터베이스 파일이 다운로드되었습니다:', filename);
      return true;
    } catch (error) {
      console.error('파일 내보내기 오류:', error);
      return false;
    }
  }

  // 파일에서 데이터베이스 가져오기
  async importFromFile(file: File): Promise<boolean> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      
      const SQL = await initSqlJs({
        locateFile: (file: string) => {
          console.log('SQL.js 파일 로드 시도:', file);
          return `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/${file}`;
        }
      });

      this.db = new SQL.Database(data);
      console.log('파일에서 데이터베이스를 가져왔습니다:', file.name);
      
      // 로컬스토리지에도 자동 저장
      this.saveToLocalStorage();
      
      return true;
    } catch (error) {
      console.error('파일 가져오기 오류:', error);
      return false;
    }
  }

  // 로컬스토리지 데이터 삭제
  clearLocalStorage(key: string = 'autofee_database') {
    try {
      localStorage.removeItem(key);
      console.log('로컬스토리지 데이터가 삭제되었습니다.');
      return true;
    } catch (error) {
      console.error('로컬스토리지 삭제 오류:', error);
      return false;
    }
  }

  // 데이터베이스 자동 저장 (데이터 변경 시마다 호출)
  autoSave() {
    this.saveToLocalStorage();
  }
}

export default Database; 