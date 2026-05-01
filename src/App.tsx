import { useEffect, useState } from 'react';
import { MantineProvider, AppShell, Group, Title, ActionIcon, Loader, Center, Text, Stack, useMantineColorScheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { IconMoon, IconSun } from '@tabler/icons-react';
import Database from './database/Database';
import BillCalculator from './services/BillCalculator';
import Dashboard from './Dashboard';
import TenantView from './TenantView';
import AdminGate from './AdminGate';

function ColorSchemeToggle() {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  return (
    <ActionIcon variant="default" size="lg" onClick={() => toggleColorScheme()} aria-label="Toggle color scheme">
      {colorScheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
    </ActionIcon>
  );
}

function Shell() {
  const [database, setDatabase] = useState<Database | null>(null);
  const [calculator, setCalculator] = useState<BillCalculator | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tenantUnitId = new URLSearchParams(window.location.search).get('u');

  useEffect(() => {
    (async () => {
      try {
        const db = new Database();
        await db.initialize();
        setDatabase(db);
        setCalculator(new BillCalculator(db));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header className="no-print">
        <Group h="100%" px="md" justify="space-between">
          <Title order={4}>{tenantUnitId ? '관리비 안내' : '관리비 대시보드'}</Title>
          <ColorSchemeToggle />
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        {loading ? (
          <Center mih="60vh"><Loader /></Center>
        ) : error || !database || !calculator ? (
          <Center mih="60vh">
            <Stack align="center" gap="xs">
              <Text c="red" fw={500}>데이터베이스 연결 실패</Text>
              {error && <Text size="sm" c="dimmed">{error}</Text>}
            </Stack>
          </Center>
        ) : tenantUnitId ? (
          <TenantView database={database} unitId={tenantUnitId} />
        ) : (
          <AdminGate database={database}>
            <Dashboard database={database} calculator={calculator} />
          </AdminGate>
        )}
      </AppShell.Main>
    </AppShell>
  );
}

export default function App() {
  return (
    <MantineProvider defaultColorScheme="auto">
      <Notifications position="top-right" />
      <Shell />
    </MantineProvider>
  );
}
