import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  TextField,
  Button,
  Card,
  CardContent,
  Alert,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  type SelectChangeEvent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,

  Chip
} from '@mui/material';
import Database, { type Unit, type MeterReading, type UnitBill } from '../database/Database';
import BillCalculator from '../services/BillCalculator';

interface BillManagementProps {
  database: Database;
  calculator: BillCalculator;
}

const BillManagement: React.FC<BillManagementProps> = ({ database, calculator }) => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [readings, setReadings] = useState<Record<string, { electricity: string; water: string }>>({});
  const [previousReadings, setPreviousReadings] = useState<Record<string, MeterReading | null>>({});
  
  // 관리비 계산 관련
  const [totalManagementFee, setTotalManagementFee] = useState<string>('');
  const [totalElectricityCost, setTotalElectricityCost] = useState<string>('');
  const [totalWaterCost, setTotalWaterCost] = useState<string>('');
  const [calculatedSharedCost, setCalculatedSharedCost] = useState<number>(0);
  const [calculatedBills, setCalculatedBills] = useState<UnitBill[]>([]);
  
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    loadUnits();
  }, [database]);

  useEffect(() => {
    loadPreviousReadings();
    loadCurrentReadings();
  }, [units, selectedYear, selectedMonth, database]);

  // 공동관리비 자동 계산
  useEffect(() => {
    const totalMgmt = parseFloat(totalManagementFee) || 0;
    const totalElec = parseFloat(totalElectricityCost) || 0;
    const totalWater = parseFloat(totalWaterCost) || 0;
    
    const sharedCost = Math.max(0, totalMgmt - totalElec - totalWater);
    setCalculatedSharedCost(sharedCost);
  }, [totalManagementFee, totalElectricityCost, totalWaterCost]);

  const loadUnits = () => {
    try {
      const unitsList = database.getUnits();
      setUnits(unitsList);
      
      const initialReadings: Record<string, { electricity: string; water: string }> = {};
      unitsList.forEach(unit => {
        initialReadings[unit.id] = { electricity: '', water: '' };
      });
      setReadings(initialReadings);
    } catch (error) {
      console.error('호실 목록 로드 오류:', error);
    }
  };

  const loadPreviousReadings = () => {
    const prevReadings: Record<string, MeterReading | null> = {};
    units.forEach(unit => {
      const prevReading = database.getPreviousMonthReading(unit.id, selectedYear, selectedMonth);
      prevReadings[unit.id] = prevReading;
    });
    setPreviousReadings(prevReadings);
  };

  const loadCurrentReadings = () => {
    const currentReadings = database.getMeterReadings(selectedYear, selectedMonth);
    const readingsMap: Record<string, { electricity: string; water: string }> = {};
    
    units.forEach(unit => {
      const current = currentReadings.find(r => r.unit_id === unit.id);
      readingsMap[unit.id] = {
        electricity: current?.electricity_reading.toString() || '',
        water: current?.water_reading.toString() || ''
      };
    });
    setReadings(readingsMap);
  };

  const handleYearChange = (event: SelectChangeEvent<number>) => {
    setSelectedYear(Number(event.target.value));
  };

  const handleMonthChange = (event: SelectChangeEvent<number>) => {
    setSelectedMonth(Number(event.target.value));
  };

  const handleReadingChange = (unitId: string, type: 'electricity' | 'water', value: string) => {
    setReadings(prev => ({
      ...prev,
      [unitId]: {
        ...prev[unitId],
        [type]: value
      }
    }));
  };

  const handleSaveReadings = () => {
    try {
      let hasError = false;
      let savedCount = 0;
      
      units.forEach(unit => {
        const electricity = parseFloat(readings[unit.id]?.electricity || '0');
        const water = parseFloat(readings[unit.id]?.water || '0');
        
        if (isNaN(electricity) || isNaN(water)) {
          hasError = true;
          return;
        }

        if (readings[unit.id]?.electricity || readings[unit.id]?.water) {
          const meterReading: MeterReading = {
            unit_id: unit.id,
            year: selectedYear,
            month: selectedMonth,
            electricity_reading: electricity,
            water_reading: water
          };

          database.saveMeterReading(meterReading);
          savedCount++;
        }
      });

      if (hasError) {
        setMessage({ type: 'error', text: '유효하지 않은 검침값이 있습니다.' });
        return;
      }

      if (savedCount === 0) {
        setMessage({ type: 'info', text: '저장할 검침값이 없습니다.' });
        return;
      }

      setMessage({ 
        type: 'success', 
        text: `${selectedYear}년 ${selectedMonth}월 검침값 ${savedCount}건이 저장되었습니다.` 
      });

      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('검침값 저장 오류:', error);
      setMessage({ type: 'error', text: '검침값 저장 중 오류가 발생했습니다.' });
    }
  };

  const handleCalculateBills = async () => {
    try {
      const totalMgmt = parseFloat(totalManagementFee);
      const totalElec = parseFloat(totalElectricityCost);
      const totalWater = parseFloat(totalWaterCost);

      if (isNaN(totalMgmt) || isNaN(totalElec) || isNaN(totalWater)) {
        setMessage({ type: 'error', text: '유효하지 않은 금액이 입력되었습니다.' });
        return;
      }

      if (totalMgmt < 0 || totalElec < 0 || totalWater < 0) {
        setMessage({ type: 'error', text: '금액은 0 이상이어야 합니다.' });
        return;
      }

      if (calculatedSharedCost < 0) {
        setMessage({ type: 'error', text: '전체 관리비가 전기료와 수도료의 합보다 작습니다.' });
        return;
      }

      // 검침값이 입력되었는지 확인
      const meterReadings = database.getMeterReadings(selectedYear, selectedMonth);
      if (meterReadings.length === 0) {
        setMessage({ 
          type: 'error', 
          text: `${selectedYear}년 ${selectedMonth}월의 검침값이 입력되지 않았습니다. 먼저 검침값을 저장해주세요.` 
        });
        return;
      }

      const bills = await calculator.calculateAndSaveBills(
        selectedYear,
        selectedMonth,
        totalElec,
        totalWater,
        calculatedSharedCost // 계산된 공동관리비 사용
      );

      setCalculatedBills(bills);
      setMessage({ 
        type: 'success', 
        text: `${selectedYear}년 ${selectedMonth}월 관리비가 계산되어 저장되었습니다.` 
      });

    } catch (error) {
      console.error('관리비 계산 오류:', error);
      setMessage({ type: 'error', text: '관리비 계산 중 오류가 발생했습니다.' });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ko-KR').format(num);
  };

  const getUsageAmount = (unitId: string, type: 'electricity' | 'water') => {
    const current = parseFloat(readings[unitId]?.[type] || '0');
    const previous = previousReadings[unitId]?.[type === 'electricity' ? 'electricity_reading' : 'water_reading'] || 0;
    return Math.max(0, current - previous);
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <Box>
      <Typography variant="h4" component="h2" gutterBottom>
        📋💰 검침값 입력 & 관리비 계산
      </Typography>
      
      {message && (
        <Alert severity={message.type} sx={{ mb: 3 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      {/* 연도/월 선택 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📅 대상 연월 선택
          </Typography>
          <Grid container spacing={3}>
            <Grid size={6}>
              <FormControl fullWidth>
                <InputLabel>년도</InputLabel>
                <Select
                  value={selectedYear}
                  label="년도"
                  onChange={handleYearChange}
                >
                  {years.map(year => (
                    <MenuItem key={year} value={year}>{year}년</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={6}>
              <FormControl fullWidth>
                <InputLabel>월</InputLabel>
                <Select
                  value={selectedMonth}
                  label="월"
                  onChange={handleMonthChange}
                >
                  {months.map(month => (
                    <MenuItem key={month} value={month}>{month}월</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* 검침값 입력 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">
              📊 검침값 입력
            </Typography>
            <Button
              variant="contained"
              onClick={handleSaveReadings}
              disabled={units.length === 0}
            >
              검침값 저장
            </Button>
          </Box>

          {units.length === 0 ? (
            <Alert severity="info">
              먼저 호실을 등록해주세요.
            </Alert>
          ) : (
            <Grid container spacing={3}>
              {units.map(unit => (
                <Grid size={{ xs: 12, md: 6 }} key={unit.id}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        {unit.name} (면적: {unit.area}m²)
                      </Typography>
                      
                      {previousReadings[unit.id] && (
                        <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                          <Typography variant="body2" color="text.secondary">
                            이전 월 검침값
                          </Typography>
                          <Typography variant="body2">
                            전기: {formatNumber(previousReadings[unit.id]?.electricity_reading || 0)} KWH
                          </Typography>
                          <Typography variant="body2">
                            수도: {formatNumber(previousReadings[unit.id]?.water_reading || 0)} m³
                          </Typography>
                        </Box>
                      )}

                      <Grid container spacing={2}>
                        <Grid size={{ xs: 6 }}>
                          <TextField
                            fullWidth
                            label="전기 검침값 (KWH)"
                            type="number"
                            value={readings[unit.id]?.electricity || ''}
                            onChange={(e) => handleReadingChange(unit.id, 'electricity', e.target.value)}
                            inputProps={{ min: 0, step: 0.1 }}
                          />
                          {readings[unit.id]?.electricity && (
                            <Typography variant="caption" color="primary">
                              사용량: {formatNumber(getUsageAmount(unit.id, 'electricity'))} KWH
                            </Typography>
                          )}
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <TextField
                            fullWidth
                            label="수도 검침값 (m³)"
                            type="number"
                            value={readings[unit.id]?.water || ''}
                            onChange={(e) => handleReadingChange(unit.id, 'water', e.target.value)}
                            inputProps={{ min: 0, step: 0.01 }}
                          />
                          {readings[unit.id]?.water && (
                            <Typography variant="caption" color="primary">
                              사용량: {formatNumber(getUsageAmount(unit.id, 'water'))} m³
                            </Typography>
                          )}
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </CardContent>
      </Card>

      {/* 관리비 계산 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">
              💰 관리비 계산
            </Typography>
            <Button
              variant="contained"
              onClick={handleCalculateBills}
              disabled={units.length === 0}
            >
              관리비 계산하기
            </Button>
          </Box>

          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                fullWidth
                label="전체 관리비 (원)"
                type="number"
                value={totalManagementFee}
                onChange={(e) => setTotalManagementFee(e.target.value)}
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                fullWidth
                label="전체 전기료 (원)"
                type="number"
                value={totalElectricityCost}
                onChange={(e) => setTotalElectricityCost(e.target.value)}
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                fullWidth
                label="전체 수도료 (원)"
                type="number"
                value={totalWaterCost}
                onChange={(e) => setTotalWaterCost(e.target.value)}
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  공동관리비 (자동계산)
                </Typography>
                <Chip 
                  label={formatCurrency(calculatedSharedCost)}
                  color={calculatedSharedCost >= 0 ? "primary" : "error"}
                  size="medium"
                />
                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                  = 전체관리비 - 전기료 - 수도료
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* 계산 결과 */}
      {calculatedBills.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              📋 계산 결과 - {selectedYear}년 {selectedMonth}월
            </Typography>
            
            <TableContainer component={Paper} elevation={0}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>호실</TableCell>
                    <TableCell align="right">전기료</TableCell>
                    <TableCell align="right">수도료</TableCell>
                    <TableCell align="right">공동관리비</TableCell>
                    <TableCell align="right">합계</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {calculatedBills.map((bill) => (
                    <TableRow key={bill.unit_id}>
                      <TableCell component="th" scope="row">
                        {units.find(u => u.id === bill.unit_id)?.name || bill.unit_id}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(bill.electricity_cost)}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(bill.water_cost)}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(bill.management_cost)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                        {formatCurrency(bill.total_cost)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow sx={{ backgroundColor: 'grey.100' }}>
                    <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>
                      합계
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      {formatCurrency(calculatedBills.reduce((sum, bill) => sum + bill.electricity_cost, 0))}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      {formatCurrency(calculatedBills.reduce((sum, bill) => sum + bill.water_cost, 0))}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      {formatCurrency(calculatedBills.reduce((sum, bill) => sum + bill.management_cost, 0))}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      {formatCurrency(calculatedBills.reduce((sum, bill) => sum + bill.total_cost, 0))}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default BillManagement; 