import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Badge,
  Box,
  Button,
  Card,
  Center,
  Divider,
  Group,
  Loader,
  Modal,
  Paper,
  PasswordInput,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { IconPrinter } from '@tabler/icons-react';
import Database, {
  type MeterReading,
  type Unit,
  type UnitBill,
} from './database/Database';
import { sha256 } from './utils/hash';

const tenantAuthKey = (unitId: string) => `autofee_tenant_${unitId}`;

const krw = (v: number) =>
  new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(Math.round(v));
const fmt = (v: number, digits = 2) =>
  v.toFixed(digits).replace(/\.?0+$/, '') || '0';
const monthLabel = (y: number, m: number) => `${y}년 ${m}월`;

const prevYM = (y: number, m: number) => {
  const pm = m - 1 || 12;
  const py = m - 1 ? y : y - 1;
  return { year: py, month: pm };
};

interface TenantViewProps {
  database: Database;
  unitId: string;
}

export default function TenantView({ database, unitId }: TenantViewProps) {
  const [unit, setUnit] = useState<Unit | null>(null);
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [unitBills, setUnitBills] = useState<UnitBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [selectedBill, setSelectedBill] = useState<UnitBill | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [units, allReadings, allBills] = await Promise.all([
          database.getUnits(),
          database.getAllMeterReadings(),
          database.getAllUnitBills(),
        ]);
        const u = units.find((x) => x.id === unitId);
        if (!u) {
          setNotFound(true);
          return;
        }
        setUnit(u);
        setReadings(allReadings.filter((r) => r.unit_id === unitId));
        setUnitBills(allBills.filter((b) => b.unit_id === unitId));

        if (!u.password_hash) {
          setAuthed(true);
        } else {
          const stored = localStorage.getItem(tenantAuthKey(unitId));
          if (stored && stored === u.password_hash) setAuthed(true);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [database, unitId]);

  const sortedBills = useMemo(
    () =>
      [...unitBills].sort((a, b) => (b.year - a.year) || (b.month - a.month)),
    [unitBills],
  );

  const readingMap = useMemo(() => {
    const m = new Map<string, MeterReading>();
    readings.forEach((r) => m.set(`${r.year}-${r.month}`, r));
    return m;
  }, [readings]);

  const detailFor = (year: number, month: number) => {
    const cur = readingMap.get(`${year}-${month}`);
    const p = prevYM(year, month);
    const prev = readingMap.get(`${p.year}-${p.month}`);
    return { cur, prev };
  };

  if (loading) {
    return <Center mih="60vh"><Loader /></Center>;
  }

  if (notFound || !unit) {
    return (
      <Center mih="60vh">
        <Stack align="center" gap="xs">
          <Text fw={600}>호실을 찾을 수 없습니다</Text>
          <Text size="sm" c="dimmed">관리자에게 정확한 링크를 요청해주세요. (요청한 ID: {unitId})</Text>
        </Stack>
      </Center>
    );
  }

  if (!authed) {
    return <TenantPasswordGate unit={unit} onAuthed={() => setAuthed(true)} />;
  }

  const latest = sortedBills[0] ?? null;
  const past = sortedBills.slice(1);

  return (
    <Stack gap="lg" maw={900} mx="auto">
      <Group justify="space-between" align="flex-end" className="no-print">
        <Stack gap={2}>
          <Title order={2}>{unit.name} 관리비 안내</Title>
          <Text c="dimmed" size="sm">전용면적 {unit.area}㎡</Text>
        </Stack>
        <Button leftSection={<IconPrinter size={16} />} variant="default" onClick={() => window.print()}>
          인쇄
        </Button>
      </Group>

      {!latest ? (
        <Paper withBorder p="lg" radius="md">
          <Center>
            <Stack align="center" gap="xs">
              <Text fw={600}>아직 청구 내역이 없습니다</Text>
              <Text size="sm" c="dimmed">관리자가 검침/계산을 완료하면 여기에 표시됩니다.</Text>
            </Stack>
          </Center>
        </Paper>
      ) : (
        <BillDetail unit={unit} bill={latest} detail={detailFor(latest.year, latest.month)} label="이번 달 청구" />
      )}

      {past.length > 0 && (
        <Stack gap="sm">
          <Title order={4} className="no-print">지난 청구 내역</Title>
          <Text size="xs" c="dimmed" className="no-print">행을 누르면 자세한 고지서가 열립니다.</Text>
          <PastBillsTable bills={past} detailFor={detailFor} onSelect={setSelectedBill} />
        </Stack>
      )}

      <Modal
        opened={!!selectedBill}
        onClose={() => setSelectedBill(null)}
        size="lg"
        withCloseButton
        title={selectedBill ? `${selectedBill.year}년 ${selectedBill.month}월 고지서` : ''}
      >
        {selectedBill && (
          <BillDetail
            unit={unit}
            bill={selectedBill}
            detail={detailFor(selectedBill.year, selectedBill.month)}
          />
        )}
      </Modal>
    </Stack>
  );
}

function TenantPasswordGate({ unit, onAuthed }: { unit: Unit; onAuthed: () => void }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!unit.password_hash) { onAuthed(); return; }
    setSubmitting(true);
    try {
      const hash = await sha256(pw);
      if (hash === unit.password_hash) {
        localStorage.setItem(tenantAuthKey(unit.id), hash);
        onAuthed();
      } else {
        setError('비밀번호가 올바르지 않습니다.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Center mih="60vh">
      <Paper withBorder p="xl" radius="md" w={360}>
        <form onSubmit={submit}>
          <Stack>
            <Stack gap={2}>
              <Title order={4}>{unit.name}</Title>
              <Text size="xs" c="dimmed">관리자가 발급한 비밀번호를 입력하세요.</Text>
            </Stack>
            <PasswordInput
              label="비밀번호"
              value={pw}
              onChange={(e) => { setPw(e.currentTarget.value); setError(null); }}
              error={error}
              autoFocus
              data-autofocus
            />
            <Button type="submit" loading={submitting}>확인</Button>
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}

function BillDetail({
  unit,
  bill,
  detail,
  label,
}: {
  unit: Unit;
  bill: UnitBill;
  detail: { cur?: MeterReading; prev?: MeterReading };
  label?: string;
}) {
  const { cur, prev } = detail;
  const elecUsage = cur && prev ? Math.max(0, cur.electricity_reading - prev.electricity_reading) : null;
  const waterUsage = cur && prev ? Math.max(0, cur.water_reading - prev.water_reading) : null;

  return (
    <Card withBorder padding="lg" radius="md" className="bill-card">
      <Stack gap="md">
        <Group justify="space-between" align="flex-end">
          <Stack gap={2}>
            {label && <Text size="sm" c="dimmed">{label}</Text>}
            <Title order={3}>{monthLabel(bill.year, bill.month)}</Title>
          </Stack>
          <Stack gap={2} align="flex-end">
            <Text size="sm" c="dimmed">납부 금액</Text>
            <Title order={2}>{krw(bill.total_cost)}</Title>
          </Stack>
        </Group>

        <Divider />

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <UsageBlock
            label="전기"
            unit="KWH"
            current={cur?.electricity_reading}
            previous={prev?.electricity_reading}
            usage={elecUsage}
            cost={bill.electricity_cost}
            digits={1}
          />
          <UsageBlock
            label="수도"
            unit="m³"
            current={cur?.water_reading}
            previous={prev?.water_reading}
            usage={waterUsage}
            cost={bill.water_cost}
            digits={2}
          />
        </SimpleGrid>

        <Divider />

        <Table withRowBorders={false} verticalSpacing={6}>
          <Table.Tbody>
            <Table.Tr>
              <Table.Td><Text c="dimmed">전기료</Text></Table.Td>
              <Table.Td ta="right">{krw(bill.electricity_cost)}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td><Text c="dimmed">수도료</Text></Table.Td>
              <Table.Td ta="right">{krw(bill.water_cost)}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>
                <Text c="dimmed">공동관리비</Text>
                <Text c="dimmed" size="xs">면적 {unit.area}㎡ 비례</Text>
              </Table.Td>
              <Table.Td ta="right">{krw(bill.management_cost)}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td><Text fw={700}>합계</Text></Table.Td>
              <Table.Td ta="right"><Text fw={700} size="lg">{krw(bill.total_cost)}</Text></Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Stack>
    </Card>
  );
}

function UsageBlock({
  label,
  unit,
  current,
  previous,
  usage,
  cost,
  digits,
}: {
  label: string;
  unit: string;
  current: number | undefined;
  previous: number | undefined;
  usage: number | null;
  cost: number;
  digits: number;
}) {
  return (
    <Box>
      <Group justify="space-between" mb={4}>
        <Text fw={600}>{label}</Text>
        <Badge variant="light">{krw(cost)}</Badge>
      </Group>
      <Table withRowBorders={false} verticalSpacing={4}>
        <Table.Tbody>
          <Table.Tr>
            <Table.Td><Text size="sm" c="dimmed">전월 검침</Text></Table.Td>
            <Table.Td ta="right"><Text size="sm">{previous !== undefined ? `${fmt(previous, digits)} ${unit}` : '—'}</Text></Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Td><Text size="sm" c="dimmed">당월 검침</Text></Table.Td>
            <Table.Td ta="right"><Text size="sm">{current !== undefined ? `${fmt(current, digits)} ${unit}` : '—'}</Text></Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Td><Text size="sm" fw={600}>사용량</Text></Table.Td>
            <Table.Td ta="right"><Text size="sm" fw={600}>{usage !== null ? `${fmt(usage, digits)} ${unit}` : '—'}</Text></Table.Td>
          </Table.Tr>
        </Table.Tbody>
      </Table>
    </Box>
  );
}

function PastBillsTable({
  bills,
  detailFor,
  onSelect,
}: {
  bills: UnitBill[];
  detailFor: (y: number, m: number) => { cur?: MeterReading; prev?: MeterReading };
  onSelect?: (bill: UnitBill) => void;
}) {
  return (
    <Paper withBorder radius="md" style={{ overflowX: 'auto' }}>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>년월</Table.Th>
            <Table.Th ta="right">전기 사용량</Table.Th>
            <Table.Th ta="right">수도 사용량</Table.Th>
            <Table.Th ta="right">전기료</Table.Th>
            <Table.Th ta="right">수도료</Table.Th>
            <Table.Th ta="right">관리비</Table.Th>
            <Table.Th ta="right">합계</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {bills.map((b) => {
            const { cur, prev } = detailFor(b.year, b.month);
            const elec = cur && prev ? Math.max(0, cur.electricity_reading - prev.electricity_reading) : null;
            const water = cur && prev ? Math.max(0, cur.water_reading - prev.water_reading) : null;
            return (
              <Table.Tr
                key={`${b.year}-${b.month}`}
                onClick={() => onSelect?.(b)}
                style={{ cursor: onSelect ? 'pointer' : 'default' }}
              >
                <Table.Td>{monthLabel(b.year, b.month)}</Table.Td>
                <Table.Td ta="right">{elec !== null ? `${fmt(elec, 1)} KWH` : '—'}</Table.Td>
                <Table.Td ta="right">{water !== null ? `${fmt(water, 2)} m³` : '—'}</Table.Td>
                <Table.Td ta="right">{krw(b.electricity_cost)}</Table.Td>
                <Table.Td ta="right">{krw(b.water_cost)}</Table.Td>
                <Table.Td ta="right">{krw(b.management_cost)}</Table.Td>
                <Table.Td ta="right"><Text fw={600}>{krw(b.total_cost)}</Text></Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}
