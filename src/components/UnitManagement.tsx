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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { type Database as SqlDatabase } from 'sql.js';
import Database, { type Unit } from '../database/Database';

interface UnitManagementProps {
  database: Database;
  onUnitsChanged?: () => void;
}

const UnitManagement: React.FC<UnitManagementProps> = ({ database, onUnitsChanged }) => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [open, setOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [unitForm, setUnitForm] = useState({ id: '', name: '', area: '' });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadUnits();
  }, [database]);

  const loadUnits = () => {
    try {
      const unitsList = database.getUnits();
      setUnits(unitsList);
    } catch (error) {
      console.error('호실 목록 로드 오류:', error);
    }
  };

  const handleOpenDialog = (unit?: Unit) => {
    if (unit) {
      setEditingUnit(unit);
      setUnitForm({ id: unit.id, name: unit.name, area: unit.area.toString() });
    } else {
      setEditingUnit(null);
      setUnitForm({ id: '', name: '', area: '' });
    }
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setEditingUnit(null);
    setUnitForm({ id: '', name: '', area: '' });
  };

  const handleSaveUnit = () => {
    try {
      const area = parseFloat(unitForm.area);
      
      if (!unitForm.id || !unitForm.name || isNaN(area) || area <= 0) {
        setMessage({ type: 'error', text: '모든 필드를 올바르게 입력해주세요.' });
        return;
      }

      // 중복 ID 체크 (편집 중이 아닌 경우)
      if (!editingUnit && units.some(u => u.id === unitForm.id)) {
        setMessage({ type: 'error', text: '이미 존재하는 호실입니다.' });
        return;
      }

      // 직접 SQL 실행
      if (!database) throw new Error('Database not initialized');
      
      const db = (database as unknown as { db: SqlDatabase }).db;
      if (!db) throw new Error('Database connection not available');
      
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO units (id, name, area) VALUES (?, ?, ?)
      `);
      stmt.run([unitForm.id, unitForm.name, area]);
      stmt.free();
      database.autoSave();

      loadUnits();
      handleCloseDialog();
      setMessage({ 
        type: 'success', 
        text: editingUnit ? '호실 정보가 수정되었습니다.' : '새 호실이 추가되었습니다.' 
      });
      
      if (onUnitsChanged) onUnitsChanged();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('호실 저장 오류:', error);
      setMessage({ type: 'error', text: '호실 저장 중 오류가 발생했습니다.' });
    }
  };

  const handleDeleteUnit = (unitId: string) => {
    const confirmed = window.confirm(`${unitId}호를 삭제하시겠습니까?\n관련된 모든 검침 데이터도 함께 삭제됩니다.`);
    if (!confirmed) return;

    try {
      if (!database) throw new Error('Database not initialized');
      
      // 관련 데이터 모두 삭제
      const db = (database as unknown as { db: SqlDatabase }).db;
      if (!db) throw new Error('Database connection not available');
      
      db.exec(`
        DELETE FROM meter_readings WHERE unit_id = '${unitId}';
        DELETE FROM unit_bills WHERE unit_id = '${unitId}';
        DELETE FROM units WHERE id = '${unitId}';
      `);
      database.autoSave();

      loadUnits();
      setMessage({ type: 'success', text: '호실이 삭제되었습니다.' });
      
      if (onUnitsChanged) onUnitsChanged();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('호실 삭제 오류:', error);
      setMessage({ type: 'error', text: '호실 삭제 중 오류가 발생했습니다.' });
    }
  };

  const totalArea = units.reduce((sum, unit) => sum + unit.area, 0);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h2">
          🏠 호실 관리
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          호실 추가
        </Button>
      </Box>

      {message && (
        <Alert severity={message.type} sx={{ mb: 3 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <Card>
        <CardContent>
          <TableContainer component={Paper} elevation={0}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>호실 ID</TableCell>
                  <TableCell>호실명</TableCell>
                  <TableCell align="right">전용면적 (m²)</TableCell>
                  <TableCell align="right">면적 비율</TableCell>
                  <TableCell align="center">관리</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {units.map((unit) => (
                  <TableRow key={unit.id}>
                    <TableCell>{unit.id}</TableCell>
                    <TableCell>{unit.name}</TableCell>
                    <TableCell align="right">{unit.area.toFixed(2)}</TableCell>
                    <TableCell align="right">
                      {totalArea > 0 ? ((unit.area / totalArea) * 100).toFixed(1) : 0}%
                    </TableCell>
                    <TableCell align="center">
                      <IconButton 
                        size="small" 
                        color="primary"
                        onClick={() => handleOpenDialog(unit)}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        color="error"
                        onClick={() => handleDeleteUnit(unit.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {units.length > 0 && (
                  <TableRow sx={{ backgroundColor: 'grey.100' }}>
                    <TableCell colSpan={2} sx={{ fontWeight: 'bold' }}>
                      전체
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      {totalArea.toFixed(2)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      100%
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {units.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                등록된 호실이 없습니다. 호실을 추가해주세요.
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* 호실 추가/편집 다이얼로그 */}
      <Dialog open={open} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingUnit ? '호실 정보 수정' : '새 호실 추가'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="호실 ID"
                value={unitForm.id}
                onChange={(e) => setUnitForm({ ...unitForm, id: e.target.value })}
                disabled={!!editingUnit}
                placeholder="예: 101, 201A"
                helperText={editingUnit ? "편집 시 변경할 수 없습니다" : "고유한 호실 번호를 입력하세요"}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="호실명"
                value={unitForm.name}
                onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })}
                placeholder="예: 101호, 201A호"
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                label="전용면적 (m²)"
                type="number"
                value={unitForm.area}
                onChange={(e) => setUnitForm({ ...unitForm, area: e.target.value })}
                inputProps={{ min: 0, step: 0.01 }}
                placeholder="예: 84.50"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>취소</Button>
          <Button onClick={handleSaveUnit} variant="contained">
            {editingUnit ? '수정' : '추가'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UnitManagement; 