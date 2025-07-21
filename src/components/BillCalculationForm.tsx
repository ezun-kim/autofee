import React, { useState } from 'react';
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
  Paper
} from '@mui/material';
import Database, { type UnitBill } from '../database/Database';
import BillCalculator from '../services/BillCalculator';

interface BillCalculationFormProps {
  database: Database;
  calculator: BillCalculator;
}

const BillCalculationForm: React.FC<BillCalculationFormProps> = ({ database, calculator }) => {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [totalElectricityCost, setTotalElectricityCost] = useState<string>('');
  const [totalWaterCost, setTotalWaterCost] = useState<string>('');
  const [totalManagementCost, setTotalManagementCost] = useState<string>('');
  const [calculatedBills, setCalculatedBills] = useState<UnitBill[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleYearChange = (event: SelectChangeEvent<number>) => {
    setSelectedYear(Number(event.target.value));
  };

  const handleMonthChange = (event: SelectChangeEvent<number>) => {
    setSelectedMonth(Number(event.target.value));
  };

  const handleCalculate = async () => {
    try {
      const electricityCost = parseFloat(totalElectricityCost);
      const waterCost = parseFloat(totalWaterCost);
      const managementCost = parseFloat(totalManagementCost);

      if (isNaN(electricityCost) || isNaN(waterCost) || isNaN(managementCost)) {
        setMessage({ type: 'error', text: '유효하지 않은 금액이 입력되었습니다.' });
        return;
      }

      if (electricityCost < 0 || waterCost < 0 || managementCost < 0) {
        setMessage({ type: 'error', text: '금액은 0 이상이어야 합니다.' });
        return;
      }

      // 검침값이 입력되었는지 확인
      const meterReadings = database.getMeterReadings(selectedYear, selectedMonth);
      if (meterReadings.length === 0) {
        setMessage({ 
          type: 'error', 
          text: `${selectedYear}년 ${selectedMonth}월의 검침값이 입력되지 않았습니다. 먼저 검침값을 입력해주세요.` 
        });
        return;
      }

      const bills = await calculator.calculateAndSaveBills(
        selectedYear,
        selectedMonth,
        electricityCost,
        waterCost,
        managementCost
      );

      setCalculatedBills(bills);
      setMessage({ 
        type: 'success', 
        text: `${selectedYear}년 ${selectedMonth}월 관리비가 계산되어 저장되었습니다.` 
      });

    } catch {
      setMessage({ type: 'error', text: '관리비 계산 중 오류가 발생했습니다.' });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(amount);
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <Box>
      <Typography variant="h4" component="h2" gutterBottom>
        💰 관리비 계산
      </Typography>
      
      {message && (
        <Alert severity={message.type} sx={{ mb: 3 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            계산 대상 월 선택
          </Typography>
          
          <Grid container spacing={3} sx={{ mb: 3 }}>
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

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            전체 요금 입력
          </Typography>
          
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid size={4}>
              <TextField
                fullWidth
                label="전체 전기료 (원)"
                type="number"
                value={totalElectricityCost}
                onChange={(e) => setTotalElectricityCost(e.target.value)}
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid size={4}>
              <TextField
                fullWidth
                label="전체 수도료 (원)"
                type="number"
                value={totalWaterCost}
                onChange={(e) => setTotalWaterCost(e.target.value)}
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid size={4}>
              <TextField
                fullWidth
                label="전체 공동관리비 (원)"
                type="number"
                value={totalManagementCost}
                onChange={(e) => setTotalManagementCost(e.target.value)}
                inputProps={{ min: 0 }}
              />
            </Grid>
          </Grid>

          <Box sx={{ textAlign: 'center' }}>
            <Button
              variant="contained"
              size="large"
              onClick={handleCalculate}
              sx={{ minWidth: 200 }}
            >
              관리비 계산하기
            </Button>
          </Box>
        </CardContent>
      </Card>

      {calculatedBills.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              계산 결과 - {selectedYear}년 {selectedMonth}월
            </Typography>
            
            <TableContainer component={Paper}>
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
                        {bill.unit_id}
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

export default BillCalculationForm; 