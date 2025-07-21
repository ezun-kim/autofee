import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
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
  Divider,
  Grid
} from '@mui/material';
import { Print as PrintIcon } from '@mui/icons-material';
import Database, { type UnitBill, type Unit } from '../database/Database';
import BillCalculator from '../services/BillCalculator';

interface BillOutputProps {
  database: Database;
  calculator: BillCalculator;
}

const BillOutput: React.FC<BillOutputProps> = ({ database, calculator }) => {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedUnit, setSelectedUnit] = useState<string>('all');
  const [bills, setBills] = useState<UnitBill[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  
  // 기간 출력 관련
  const [isRangeMode, setIsRangeMode] = useState<boolean>(false);
  const [startYear, setStartYear] = useState<number>(new Date().getFullYear());
  const [startMonth, setStartMonth] = useState<number>(new Date().getMonth() + 1);
  const [endYear, setEndYear] = useState<number>(new Date().getFullYear());
  const [endMonth, setEndMonth] = useState<number>(new Date().getMonth() + 1);
  const [rangeBills, setRangeBills] = useState<Array<{year: number, month: number, bills: UnitBill[]}>>([]);

  useEffect(() => {
    const loadUnits = () => {
      const unitsList = database.getUnits();
      setUnits(unitsList);
    };

    loadUnits();
  }, [database]);

  const handleYearChange = (event: SelectChangeEvent<number>) => {
    setSelectedYear(Number(event.target.value));
  };

  const handleMonthChange = (event: SelectChangeEvent<number>) => {
    setSelectedMonth(Number(event.target.value));
  };

  const handleUnitChange = (event: SelectChangeEvent<string>) => {
    setSelectedUnit(event.target.value);
  };

  const handleStartYearChange = (event: SelectChangeEvent<number>) => {
    setStartYear(Number(event.target.value));
  };

  const handleStartMonthChange = (event: SelectChangeEvent<number>) => {
    setStartMonth(Number(event.target.value));
  };

  const handleEndYearChange = (event: SelectChangeEvent<number>) => {
    setEndYear(Number(event.target.value));
  };

  const handleEndMonthChange = (event: SelectChangeEvent<number>) => {
    setEndMonth(Number(event.target.value));
  };

  const loadBills = () => {
    try {
      console.log('고지서 조회 시작:', selectedYear, selectedMonth);
      const unitBills = database.getUnitBills(selectedYear, selectedMonth);
      console.log('조회된 고지서 데이터:', unitBills);
      
      if (unitBills.length === 0) {
        setMessage({ 
          type: 'info', 
          text: `${selectedYear}년 ${selectedMonth}월의 계산된 관리비가 없습니다. 먼저 관리비를 계산해주세요.` 
        });
        setBills([]);
        return;
      }

      setBills(unitBills);
      setMessage(null);
    } catch (error) {
      console.error('고지서 조회 오류:', error);
      setMessage({ type: 'error', text: '관리비 데이터를 불러오는 중 오류가 발생했습니다.' });
    }
  };

  const loadRangeBills = () => {
    try {
      console.log('기간 고지서 조회 시작:', startYear, startMonth, '~', endYear, endMonth);
      
      const rangeBillsData: Array<{year: number, month: number, bills: UnitBill[]}> = [];
      let currentYear = startYear;
      let currentMonth = startMonth;
      
      while (
        currentYear < endYear || 
        (currentYear === endYear && currentMonth <= endMonth)
      ) {
        const unitBills = database.getUnitBills(currentYear, currentMonth);
        if (unitBills.length > 0) {
          rangeBillsData.push({
            year: currentYear,
            month: currentMonth,
            bills: unitBills
          });
        }
        
        currentMonth++;
        if (currentMonth > 12) {
          currentMonth = 1;
          currentYear++;
        }
      }
      
      if (rangeBillsData.length === 0) {
        setMessage({ 
          type: 'info', 
          text: `${startYear}년 ${startMonth}월 ~ ${endYear}년 ${endMonth}월 기간의 계산된 관리비가 없습니다.` 
        });
        setRangeBills([]);
        return;
      }

      setRangeBills(rangeBillsData);
      setMessage(null);
    } catch (error) {
      console.error('기간 고지서 조회 오류:', error);
      setMessage({ type: 'error', text: '기간 관리비 데이터를 불러오는 중 오류가 발생했습니다.' });
    }
  };

  const handlePrint = () => {
    window.print();
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

  const getUsageDetails = (unitId: string) => {
    return calculator.getUsageDetails(unitId, selectedYear, selectedMonth);
  };

  const filteredBills = selectedUnit === 'all' ? bills : bills.filter(bill => bill.unit_id === selectedUnit);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <Box>
      <Typography variant="h4" component="h2" gutterBottom>
        📄 고지서 출력
      </Typography>
      
      {message && (
        <Alert severity={message.type} sx={{ mb: 3 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <Button
              variant={!isRangeMode ? "contained" : "outlined"}
              onClick={() => setIsRangeMode(false)}
            >
              📄 단일 월 고지서
            </Button>
            <Button
              variant={isRangeMode ? "contained" : "outlined"}
              onClick={() => setIsRangeMode(true)}
            >
              📅 기간별 고지서
            </Button>
          </Box>

          {!isRangeMode ? (
            // 단일 월 선택
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid size={3}>
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
              <Grid size={3}>
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
              <Grid size={3}>
                <FormControl fullWidth>
                  <InputLabel>호실</InputLabel>
                  <Select
                    value={selectedUnit}
                    label="호실"
                    onChange={handleUnitChange}
                  >
                    <MenuItem value="all">전체</MenuItem>
                    {units.map(unit => (
                      <MenuItem key={unit.id} value={unit.id}>{unit.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={3}>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={loadBills}
                  sx={{ height: '56px' }}
                >
                  고지서 조회
                </Button>
              </Grid>
            </Grid>
          ) : (
            // 기간 선택
            <>
              <Typography variant="h6" gutterBottom>
                📅 기간별 고지서 출력
              </Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 2 }}>
                  <FormControl fullWidth>
                    <InputLabel>시작년도</InputLabel>
                    <Select
                      value={startYear}
                      label="시작년도"
                      onChange={handleStartYearChange}
                    >
                      {years.map(year => (
                        <MenuItem key={year} value={year}>{year}년</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 2 }}>
                  <FormControl fullWidth>
                    <InputLabel>시작월</InputLabel>
                    <Select
                      value={startMonth}
                      label="시작월"
                      onChange={handleStartMonthChange}
                    >
                      {months.map(month => (
                        <MenuItem key={month} value={month}>{month}월</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 2 }}>
                  <FormControl fullWidth>
                    <InputLabel>끝년도</InputLabel>
                    <Select
                      value={endYear}
                      label="끝년도"
                      onChange={handleEndYearChange}
                    >
                      {years.map(year => (
                        <MenuItem key={year} value={year}>{year}년</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 2 }}>
                  <FormControl fullWidth>
                    <InputLabel>끝월</InputLabel>
                    <Select
                      value={endMonth}
                      label="끝월"
                      onChange={handleEndMonthChange}
                    >
                      {months.map(month => (
                        <MenuItem key={month} value={month}>{month}월</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 2 }}>
                  <FormControl fullWidth>
                    <InputLabel>호실</InputLabel>
                    <Select
                      value={selectedUnit}
                      label="호실"
                      onChange={handleUnitChange}
                    >
                      <MenuItem value="all">전체</MenuItem>
                      {units.map(unit => (
                        <MenuItem key={unit.id} value={unit.id}>{unit.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 2 }}>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={loadRangeBills}
                    sx={{ height: '56px' }}
                  >
                    기간 조회
                  </Button>
                </Grid>
              </Grid>
            </>
          )}

          {(filteredBills.length > 0 || rangeBills.length > 0) && (
            <Box sx={{ textAlign: 'center' }}>
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
                onClick={handlePrint}
                sx={{ minWidth: 150 }}
              >
                인쇄하기
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      {filteredBills.length > 0 && (
        <Box className="print-content">
          {filteredBills.map((bill) => {
            const unit = units.find(u => u.id === bill.unit_id);
            const usageDetails = getUsageDetails(bill.unit_id);
            
            return (
              <Card key={bill.unit_id} sx={{ mb: 4, pageBreakAfter: 'always' }}>
                <CardContent sx={{ p: 4 }}>
                  {/* 고지서 헤더 */}
                  <Box sx={{ textAlign: 'center', mb: 4 }}>
                    <Typography variant="h3" component="h1" gutterBottom>
                      관리비 고지서
                    </Typography>
                    <Typography variant="h5" color="text.secondary">
                      {selectedYear}년 {selectedMonth}월
                    </Typography>
                  </Box>

                  {/* 호실 정보 */}
                  <Box sx={{ mb: 4 }}>
                    <Typography variant="h5" gutterBottom>
                      📍 {bill.unit_id}호 ({unit?.area}m²)
                    </Typography>
                  </Box>

                  <Divider sx={{ mb: 3 }} />

                  {/* 사용량 정보 */}
                  {usageDetails && (
                    <Box sx={{ mb: 4 }}>
                      <Typography variant="h6" gutterBottom>
                        📊 사용량 내역
                      </Typography>
                      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e0e0e0' }}>
                        <Table>
                          <TableHead>
                            <TableRow>
                              <TableCell>구분</TableCell>
                              <TableCell align="right">전월 검침</TableCell>
                              <TableCell align="right">당월 검침</TableCell>
                              <TableCell align="right">사용량</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            <TableRow>
                              <TableCell>전기료</TableCell>
                              <TableCell align="right">{formatNumber(usageDetails.previousElectricity)} KWH</TableCell>
                              <TableCell align="right">{formatNumber(usageDetails.currentElectricity)} KWH</TableCell>
                              <TableCell align="right">{formatNumber(usageDetails.electricityUsage)} KWH</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>수도료</TableCell>
                              <TableCell align="right">{formatNumber(usageDetails.previousWater)} m³</TableCell>
                              <TableCell align="right">{formatNumber(usageDetails.currentWater)} m³</TableCell>
                              <TableCell align="right">{formatNumber(usageDetails.waterUsage)} m³</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  )}

                  {/* 요금 내역 */}
                  <Box sx={{ mb: 4 }}>
                    <Typography variant="h6" gutterBottom>
                      💰 요금 내역
                    </Typography>
                    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e0e0e0' }}>
                      <Table>
                        <TableHead>
                          <TableRow sx={{ backgroundColor: 'grey.100' }}>
                            <TableCell>구분</TableCell>
                            <TableCell align="right">요금</TableCell>
                            <TableCell>비고</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          <TableRow>
                            <TableCell>전기료</TableCell>
                            <TableCell align="right">{formatCurrency(bill.electricity_cost)}</TableCell>
                            <TableCell>사용량 비례</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>수도료</TableCell>
                            <TableCell align="right">{formatCurrency(bill.water_cost)}</TableCell>
                            <TableCell>사용량 비례</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>공동관리비</TableCell>
                            <TableCell align="right">{formatCurrency(bill.management_cost)}</TableCell>
                            <TableCell>면적 비례 ({unit?.area}m²)</TableCell>
                          </TableRow>
                          <TableRow sx={{ backgroundColor: 'primary.light' }}>
                            <TableCell sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                              합계 (납기내)
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                              {formatCurrency(bill.total_cost)}
                            </TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>

                  {/* 납부 안내 */}
                  <Box sx={{ mt: 4, p: 3, backgroundColor: 'grey.50', borderRadius: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      📅 납부 안내
                    </Typography>
                    <Typography variant="body1" paragraph>
                      • 납부 기한: 매월 말일까지
                    </Typography>
                    <Typography variant="body1" paragraph>
                      • 연체 시 연체료가 부과될 수 있습니다.
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}

      {/* 기간별 고지서 출력 */}
      {isRangeMode && rangeBills.length > 0 && (
        <Box className="print-content" sx={{ mt: 3 }}>
          <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
            📅 기간별 고지서 ({startYear}년 {startMonth}월 ~ {endYear}년 {endMonth}월)
          </Typography>
          
          {selectedUnit === 'all' ? (
            // 전체 호실: 호실별로 그룹핑하여 표시
            (() => {
              const filteredUnits = units.filter(unit => 
                rangeBills.some(monthData => 
                  monthData.bills.some(bill => bill.unit_id === unit.id)
                )
              );
              
              return filteredUnits.map(unit => (
                <Card key={unit.id} sx={{ mb: 4, pageBreakInside: 'avoid' }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
                      🏠 {unit.name} (면적: {unit.area}m²)
                    </Typography>
                    
                    {/* 요금 내역 테이블 */}
                    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e0e0e0' }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ backgroundColor: 'grey.100' }}>
                            <TableCell>년월</TableCell>
                            <TableCell align="right">전기료</TableCell>
                            <TableCell align="right">수도료</TableCell>
                            <TableCell align="right">공동관리비</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>합계</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {rangeBills.map(monthData => {
                            const bill = monthData.bills.find(b => b.unit_id === unit.id);
                            return bill ? (
                              <TableRow key={`${monthData.year}-${monthData.month}`}>
                                <TableCell sx={{ fontWeight: 'medium' }}>
                                  {monthData.year}년 {monthData.month}월
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
                                <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: 'primary.light' }}>
                                  {formatCurrency(bill.total_cost)}
                                </TableCell>
                              </TableRow>
                            ) : null;
                          })}
                          <TableRow sx={{ backgroundColor: 'grey.200' }}>
                            <TableCell sx={{ fontWeight: 'bold' }}>합계</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                              {formatCurrency(rangeBills.reduce((sum, monthData) => {
                                const bill = monthData.bills.find(b => b.unit_id === unit.id);
                                return sum + (bill?.electricity_cost || 0);
                              }, 0))}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                              {formatCurrency(rangeBills.reduce((sum, monthData) => {
                                const bill = monthData.bills.find(b => b.unit_id === unit.id);
                                return sum + (bill?.water_cost || 0);
                              }, 0))}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                              {formatCurrency(rangeBills.reduce((sum, monthData) => {
                                const bill = monthData.bills.find(b => b.unit_id === unit.id);
                                return sum + (bill?.management_cost || 0);
                              }, 0))}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: 'primary.main', color: 'white' }}>
                              {formatCurrency(rangeBills.reduce((sum, monthData) => {
                                const bill = monthData.bills.find(b => b.unit_id === unit.id);
                                return sum + (bill?.total_cost || 0);
                              }, 0))}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>

                    {/* 검침 상세 내역 테이블 */}
                    <Box sx={{ mt: 3 }}>
                      <Typography variant="h6" gutterBottom>
                        📊 {unit.name} - 검침 상세 내역
                      </Typography>
                      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e0e0e0' }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ backgroundColor: 'grey.100' }}>
                              <TableCell>년월</TableCell>
                              <TableCell align="right">전기 검침 (KWH)</TableCell>
                              <TableCell align="right">전기 사용량</TableCell>
                              <TableCell align="right">수도 검침 (m³)</TableCell>
                              <TableCell align="right">수도 사용량</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {rangeBills.map(monthData => {
                              const usageDetails = calculator.getUsageDetails(unit.id, monthData.year, monthData.month);
                              return usageDetails ? (
                                <TableRow key={`${monthData.year}-${monthData.month}-detail`}>
                                  <TableCell sx={{ fontWeight: 'medium' }}>
                                    {monthData.year}년 {monthData.month}월
                                  </TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 'medium' }}>
                                    {formatNumber(usageDetails.currentElectricity)}
                                  </TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                                    {formatNumber(usageDetails.electricityUsage)}
                                  </TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 'medium' }}>
                                    {formatNumber(usageDetails.currentWater)}
                                  </TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                                    {formatNumber(usageDetails.waterUsage)}
                                  </TableCell>
                                </TableRow>
                              ) : null;
                            })}
                            <TableRow sx={{ backgroundColor: 'grey.200' }}>
                              <TableCell sx={{ fontWeight: 'bold' }}>총 사용량</TableCell>
                              <TableCell align="center" sx={{ color: 'text.secondary' }}>-</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                {formatNumber(rangeBills.reduce((sum, monthData) => {
                                  const usageDetails = calculator.getUsageDetails(unit.id, monthData.year, monthData.month);
                                  return sum + (usageDetails?.electricityUsage || 0);
                                }, 0))}
                              </TableCell>
                              <TableCell align="center" sx={{ color: 'text.secondary' }}>-</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                {formatNumber(rangeBills.reduce((sum, monthData) => {
                                  const usageDetails = calculator.getUsageDetails(unit.id, monthData.year, monthData.month);
                                  return sum + (usageDetails?.waterUsage || 0);
                                }, 0))}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  </CardContent>
                </Card>
              ));
            })()
          ) : (
            // 특정 호실: 해당 호실의 기간별 데이터만 표시
            (() => {
              const unit = units.find(u => u.id === selectedUnit);
              const unitRangeBills = rangeBills.filter(monthData => 
                monthData.bills.some(bill => bill.unit_id === selectedUnit)
              );
              
              return (
                <Card sx={{ mb: 4 }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
                      🏠 {unit?.name} (면적: {unit?.area}m²) - 기간별 관리비 내역
                    </Typography>
                    
                    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e0e0e0' }}>
                      <Table>
                        <TableHead>
                          <TableRow sx={{ backgroundColor: 'grey.100' }}>
                            <TableCell>년월</TableCell>
                            <TableCell align="right">전기료</TableCell>
                            <TableCell align="right">수도료</TableCell>
                            <TableCell align="right">공동관리비</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>합계</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {unitRangeBills.map(monthData => {
                            const bill = monthData.bills.find(b => b.unit_id === selectedUnit);
                            return bill ? (
                              <TableRow key={`${monthData.year}-${monthData.month}`}>
                                <TableCell sx={{ fontWeight: 'medium' }}>
                                  {monthData.year}년 {monthData.month}월
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
                                <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: 'primary.light' }}>
                                  {formatCurrency(bill.total_cost)}
                                </TableCell>
                              </TableRow>
                            ) : null;
                          })}
                          <TableRow sx={{ backgroundColor: 'grey.200' }}>
                            <TableCell sx={{ fontWeight: 'bold' }}>평균</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                              {formatCurrency(unitRangeBills.reduce((sum, monthData) => {
                                const bill = monthData.bills.find(b => b.unit_id === selectedUnit);
                                return sum + (bill?.electricity_cost || 0);
                              }, 0) / unitRangeBills.length)}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                              {formatCurrency(unitRangeBills.reduce((sum, monthData) => {
                                const bill = monthData.bills.find(b => b.unit_id === selectedUnit);
                                return sum + (bill?.water_cost || 0);
                              }, 0) / unitRangeBills.length)}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                              {formatCurrency(unitRangeBills.reduce((sum, monthData) => {
                                const bill = monthData.bills.find(b => b.unit_id === selectedUnit);
                                return sum + (bill?.management_cost || 0);
                              }, 0) / unitRangeBills.length)}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: 'info.main', color: 'white' }}>
                              {formatCurrency(unitRangeBills.reduce((sum, monthData) => {
                                const bill = monthData.bills.find(b => b.unit_id === selectedUnit);
                                return sum + (bill?.total_cost || 0);
                              }, 0) / unitRangeBills.length)}
                            </TableCell>
                          </TableRow>
                          <TableRow sx={{ backgroundColor: 'grey.300' }}>
                            <TableCell sx={{ fontWeight: 'bold' }}>합계</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                              {formatCurrency(unitRangeBills.reduce((sum, monthData) => {
                                const bill = monthData.bills.find(b => b.unit_id === selectedUnit);
                                return sum + (bill?.electricity_cost || 0);
                              }, 0))}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                              {formatCurrency(unitRangeBills.reduce((sum, monthData) => {
                                const bill = monthData.bills.find(b => b.unit_id === selectedUnit);
                                return sum + (bill?.water_cost || 0);
                              }, 0))}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                              {formatCurrency(unitRangeBills.reduce((sum, monthData) => {
                                const bill = monthData.bills.find(b => b.unit_id === selectedUnit);
                                return sum + (bill?.management_cost || 0);
                              }, 0))}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: 'primary.main', color: 'white' }}>
                              {formatCurrency(unitRangeBills.reduce((sum, monthData) => {
                                const bill = monthData.bills.find(b => b.unit_id === selectedUnit);
                                return sum + (bill?.total_cost || 0);
                              }, 0))}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                                         
                    {/* 검침 상세 내역 테이블 */}
                    <Box sx={{ mt: 3 }}>
                      <Typography variant="h6" gutterBottom>
                        📊 {unit?.name} - 검침 상세 내역
                      </Typography>
                      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e0e0e0' }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ backgroundColor: 'grey.100' }}>
                              <TableCell>년월</TableCell>
                              <TableCell align="right">전기 검침 (KWH)</TableCell>
                              <TableCell align="right">전기 사용량</TableCell>
                              <TableCell align="right">수도 검침 (m³)</TableCell>
                              <TableCell align="right">수도 사용량</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {unitRangeBills.map(monthData => {
                              const usageDetails = calculator.getUsageDetails(selectedUnit, monthData.year, monthData.month);
                              return usageDetails ? (
                                <TableRow key={`${monthData.year}-${monthData.month}-detail`}>
                                  <TableCell sx={{ fontWeight: 'medium' }}>
                                    {monthData.year}년 {monthData.month}월
                                  </TableCell>
                                  <TableCell align="right">
                                    <Box sx={{ fontSize: '0.875rem' }}>
                                      <div>전월: {formatNumber(usageDetails.previousElectricity)}</div>
                                      <div>당월: <strong>{formatNumber(usageDetails.currentElectricity)}</strong></div>
                                    </Box>
                                  </TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                                    {formatNumber(usageDetails.electricityUsage)}
                                  </TableCell>
                                  <TableCell align="right">
                                    <Box sx={{ fontSize: '0.875rem' }}>
                                      <div>전월: {formatNumber(usageDetails.previousWater)}</div>
                                      <div>당월: <strong>{formatNumber(usageDetails.currentWater)}</strong></div>
                                    </Box>
                                  </TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                                    {formatNumber(usageDetails.waterUsage)}
                                  </TableCell>
                                </TableRow>
                              ) : null;
                            })}
                            <TableRow sx={{ backgroundColor: 'grey.200' }}>
                              <TableCell sx={{ fontWeight: 'bold' }}>총 사용량</TableCell>
                              <TableCell align="center" sx={{ color: 'text.secondary' }}>-</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                {formatNumber(unitRangeBills.reduce((sum, monthData) => {
                                  const usageDetails = calculator.getUsageDetails(selectedUnit, monthData.year, monthData.month);
                                  return sum + (usageDetails?.electricityUsage || 0);
                                }, 0))}
                              </TableCell>
                              <TableCell align="center" sx={{ color: 'text.secondary' }}>-</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                {formatNumber(unitRangeBills.reduce((sum, monthData) => {
                                  const usageDetails = calculator.getUsageDetails(selectedUnit, monthData.year, monthData.month);
                                  return sum + (usageDetails?.waterUsage || 0);
                                }, 0))}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  </CardContent>
                </Card>
              );
            })()
          )}
        </Box>
      )}

      <style>
        {`
          @media print {
            .print-content {
              font-size: 12pt;
            }
            
            .print-content .MuiCard-root {
              box-shadow: none !important;
              border: 1px solid #000 !important;
            }
            
            .print-content .MuiTableContainer-root {
              box-shadow: none !important;
            }
          }
        `}
      </style>
    </Box>
  );
};

export default BillOutput; 