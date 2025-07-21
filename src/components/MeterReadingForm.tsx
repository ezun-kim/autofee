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
  type SelectChangeEvent
} from '@mui/material';

import Database, { type Unit, type MeterReading } from '../database/Database';

interface MeterReadingFormProps {
  database: Database;
}

const MeterReadingForm: React.FC<MeterReadingFormProps> = ({ database }) => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [readings, setReadings] = useState<Record<string, { electricity: string; water: string }>>({});
  const [previousReadings, setPreviousReadings] = useState<Record<string, MeterReading | null>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const loadUnits = () => {
      const unitsList = database.getUnits();
      setUnits(unitsList);
      
      // 초기값 설정
      const initialReadings: Record<string, { electricity: string; water: string }> = {};
      unitsList.forEach(unit => {
        initialReadings[unit.id] = { electricity: '', water: '' };
      });
      setReadings(initialReadings);
    };

    loadUnits();
  }, [database]);

  useEffect(() => {
    // 이전 월 검침값 로드
    const loadPreviousReadings = () => {
      const prevReadings: Record<string, MeterReading | null> = {};
      units.forEach(unit => {
        const prevReading = database.getPreviousMonthReading(unit.id, selectedYear, selectedMonth);
        prevReadings[unit.id] = prevReading;
      });
      setPreviousReadings(prevReadings);
    };

    if (units.length > 0) {
      loadPreviousReadings();
    }
  }, [units, selectedYear, selectedMonth, database]);

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

  const handleSubmit = () => {
    try {
      let hasError = false;
      
      units.forEach(unit => {
        const electricity = parseFloat(readings[unit.id]?.electricity || '0');
        const water = parseFloat(readings[unit.id]?.water || '0');
        
        if (isNaN(electricity) || isNaN(water)) {
          hasError = true;
          return;
        }

        const meterReading: MeterReading = {
          unit_id: unit.id,
          year: selectedYear,
          month: selectedMonth,
          electricity_reading: electricity,
          water_reading: water
        };

        database.saveMeterReading(meterReading);
      });

      if (hasError) {
        setMessage({ type: 'error', text: '유효하지 않은 검침값이 있습니다.' });
        return;
      }

      setMessage({ 
        type: 'success', 
        text: `${selectedYear}년 ${selectedMonth}월 검침값이 저장되었습니다.` 
      });

      // 성공 후 입력값 초기화
      const resetReadings: Record<string, { electricity: string; water: string }> = {};
      units.forEach(unit => {
        resetReadings[unit.id] = { electricity: '', water: '' };
      });
      setReadings(resetReadings);

    } catch {
      setMessage({ type: 'error', text: '검침값 저장 중 오류가 발생했습니다.' });
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <Box>
      <Typography variant="h4" component="h2" gutterBottom>
        📋 검침값 입력
      </Typography>
      
      {message && (
        <Alert severity={message.type} sx={{ mb: 3 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={6}>
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
        <Grid item xs={6}>
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

      <Grid container spacing={3}>
        {units.map(unit => (
          <Grid item xs={12} md={6} key={unit.id}>
            <Card>
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
                      전기: {previousReadings[unit.id]?.electricity_reading.toLocaleString()} KWH
                    </Typography>
                    <Typography variant="body2">
                      수도: {previousReadings[unit.id]?.water_reading.toLocaleString()} m³
                    </Typography>
                  </Box>
                )}

                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="전기 검침값 (KWH)"
                      type="number"
                      value={readings[unit.id]?.electricity || ''}
                      onChange={(e) => handleReadingChange(unit.id, 'electricity', e.target.value)}
                      inputProps={{ min: 0, step: 0.1 }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="수도 검침값 (m³)"
                      type="number"
                      value={readings[unit.id]?.water || ''}
                      onChange={(e) => handleReadingChange(unit.id, 'water', e.target.value)}
                      inputProps={{ min: 0, step: 0.01 }}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ mt: 3, textAlign: 'center' }}>
        <Button
          variant="contained"
          size="large"
          onClick={handleSubmit}
          sx={{ minWidth: 200 }}
        >
          검침값 저장
        </Button>
      </Box>
    </Box>
  );
};

export default MeterReadingForm; 