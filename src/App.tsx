import React, { useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Container, Box, Tabs, Tab, Typography, Paper, Button, Alert } from '@mui/material';
import Database from './database/Database';
import BillCalculator from './services/BillCalculator';
import UnitManagement from './components/UnitManagement';
import BillManagement from './components/BillManagement';
import BillOutput from './components/BillOutput.tsx';
import { insertSampleData } from './utils/sampleData';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function App() {
  const [database, setDatabase] = useState<Database | null>(null);
  const [calculator, setCalculator] = useState<BillCalculator | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [sampleDataMessage, setSampleDataMessage] = useState<string | null>(null);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);

  useEffect(() => {
    const initializeDatabase = async () => {
      try {
        console.log('App: Database 초기화 시작');
        const db = new Database();
        
        // 먼저 로컬스토리지에서 로드 시도
        const loaded = await db.loadFromLocalStorage();
        
        if (!loaded) {
          // 로컬스토리지에 데이터가 없으면 새로 초기화
          console.log('App: 새 데이터베이스 생성');
          await db.initialize();
        }
        
        console.log('App: Database 초기화 완료');
        
        const calc = new BillCalculator(db);
        console.log('App: Calculator 생성 완료');
        
        setDatabase(db);
        setCalculator(calc);
        setIsLoading(false);
        console.log('App: 모든 초기화 완료');
      } catch (error) {
        console.error('App: 데이터베이스 초기화 실패:', error);
        setIsLoading(false);
      }
    };

    initializeDatabase();
  }, []);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleLoadSampleData = () => {
    if (!database) return;
    
    const success = insertSampleData(database);
    if (success) {
      setSampleDataMessage('이미지 기반 샘플 데이터가 로드되었습니다. (2024년 1-2월 검침 데이터)');
    } else {
      setSampleDataMessage('샘플 데이터 로드에 실패했습니다.');
    }
    
    setTimeout(() => setSampleDataMessage(null), 3000);
  };

  const handleExportDatabase = () => {
    if (!database) return;
    
    const success = database.exportToFile(`관리비_백업_${new Date().toISOString().split('T')[0]}.db`);
    if (success) {
      setBackupMessage('데이터베이스 백업 파일이 다운로드되었습니다.');
    } else {
      setBackupMessage('백업 다운로드에 실패했습니다.');
    }
    
    setTimeout(() => setBackupMessage(null), 3000);
  };

  const handleImportDatabase = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!database || !event.target.files || event.target.files.length === 0) return;
    
    const file = event.target.files[0];
    const success = await database.importFromFile(file);
    
    if (success) {
      setBackupMessage('데이터베이스가 성공적으로 복원되었습니다.');
      // 페이지 새로고침으로 상태 재설정
      setTimeout(() => window.location.reload(), 1000);
    } else {
      setBackupMessage('데이터베이스 복원에 실패했습니다.');
    }
    
    // 파일 입력 리셋
    event.target.value = '';
    setTimeout(() => setBackupMessage(null), 3000);
  };

  const handleClearData = () => {
    if (!database) return;
    
    const confirmed = window.confirm('모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.');
    if (!confirmed) return;
    
    database.clearLocalStorage();
    setBackupMessage('모든 데이터가 삭제되었습니다.');
    
    // 페이지 새로고침으로 새 데이터베이스 생성
    setTimeout(() => window.location.reload(), 1000);
  };

  if (isLoading) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Container maxWidth="md">
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <Typography variant="h6">데이터베이스 초기화 중...</Typography>
          </Box>
        </Container>
      </ThemeProvider>
    );
  }

  if (!database || !calculator) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Container maxWidth="md">
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <Typography variant="h6" color="error">
              데이터베이스 초기화에 실패했습니다.
            </Typography>
          </Box>
        </Container>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="lg">
        <Box sx={{ py: 4 }}>
          <Typography variant="h3" component="h1" gutterBottom align="center">
            🏠 관리비 자동 고지서 시스템
          </Typography>
          
          {sampleDataMessage && (
            <Alert severity="success" sx={{ mb: 3 }}>
              {sampleDataMessage}
            </Alert>
          )}
          
          {backupMessage && (
            <Alert severity="info" sx={{ mb: 3 }}>
              {backupMessage}
            </Alert>
          )}
          
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Box sx={{ mb: 2 }}>
              <Button 
                variant="outlined" 
                onClick={handleLoadSampleData}
                sx={{ mr: 2 }}
              >
                📊 샘플 데이터 로드
              </Button>
              <Button 
                variant="outlined"
                onClick={handleExportDatabase}
                sx={{ mr: 2 }}
              >
                💾 백업 다운로드
              </Button>
              <Button 
                variant="outlined"
                component="label"
                sx={{ mr: 2 }}
              >
                📂 백업 복원
                <input
                  type="file"
                  accept=".db"
                  hidden
                  onChange={handleImportDatabase}
                />
              </Button>
              <Button 
                variant="outlined"
                color="error"
                onClick={handleClearData}
              >
                🗑️ 모든 데이터 삭제
              </Button>
            </Box>
            <Typography variant="body2" color="text.secondary">
              • 샘플 데이터: 이미지 기준 2024년 1-2월 검침 데이터 자동 입력<br/>
              • 백업/복원: 데이터는 자동으로 로컬스토리지에 저장되며, 파일로도 백업 가능
            </Typography>
          </Box>
          
          <Paper sx={{ mt: 4 }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabValue} onChange={handleTabChange} aria-label="관리비 시스템 탭">
                <Tab label="🏠 호실 관리" />
                <Tab label="📋💰 검침값 & 관리비" />
                <Tab label="📄 고지서 출력" />
              </Tabs>
            </Box>
            
            <TabPanel value={tabValue} index={0}>
              <UnitManagement database={database} />
            </TabPanel>
            
            <TabPanel value={tabValue} index={1}>
              <BillManagement database={database} calculator={calculator} />
            </TabPanel>
            
            <TabPanel value={tabValue} index={2}>
              <BillOutput database={database} calculator={calculator} />
            </TabPanel>
          </Paper>
        </Box>
      </Container>
    </ThemeProvider>
  );
}

export default App;
