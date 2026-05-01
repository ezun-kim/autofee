import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Modal,
  NumberInput,
  PasswordInput,
  Popover,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconCopy, IconInfoCircle, IconKey, IconLogout, IconPencil, IconPlus, IconPrinter, IconTrash } from '@tabler/icons-react';
import { sha256 } from './utils/hash';
import { changeAdminPassword, logoutAdmin } from './AdminGate';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type CellContext,
  type ColumnDef,
  type RowData,
} from '@tanstack/react-table';
import Database, {
  type MeterReading,
  type MonthlyBill,
  type Unit,
  type UnitBill,
} from './database/Database';
import BillCalculator from './services/BillCalculator';

interface DashboardProps {
  database: Database;
  calculator: BillCalculator;
}

interface MatrixRow {
  year: number;
  month: number;
  monthlyBill: MonthlyBill | null;
  readingsByUnit: Record<string, MeterReading | undefined>;
  prevReadingsByUnit: Record<string, MeterReading | undefined>;
  unitBillsByUnit: Record<string, UnitBill | undefined>;
}

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    decimals?: number;
    currency?: boolean;
    editable?: boolean;
  }
  interface TableMeta<TData extends RowData> {
    updateCell?: (row: TData, columnId: string, value: number) => Promise<void>;
  }
}

const krwFmt = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0,
});
const krw = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : krwFmt.format(Math.round(v));

const num = (v: number | null | undefined, digits = 2) => {
  if (v === null || v === undefined) return '—';
  return new Intl.NumberFormat('ko-KR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(v);
};

const formatCellValue = (
  v: number | null | undefined,
  meta: { decimals?: number; currency?: boolean } = {},
) => (meta.currency ? krw(v) : num(v, meta.decimals ?? 2));

const numberCellStyle = {
  textAlign: 'right' as const,
  fontVariantNumeric: 'tabular-nums' as const,
  padding: '2px 6px',
};

function ReadOnlyNumberCell(props: CellContext<MatrixRow, unknown>) {
  const value = props.getValue() as number | null | undefined;
  const meta = props.column.columnDef.meta ?? {};
  const display = formatCellValue(value, meta);
  return (
    <Box style={numberCellStyle}>
      {display === '—' ? <Text c="dimmed" component="span">—</Text> : display}
    </Box>
  );
}

function EditableNumberCell(props: CellContext<MatrixRow, unknown>) {
  const { getValue, row, column, table } = props;
  const initial = getValue() as number | null | undefined;
  const meta = column.columnDef.meta ?? {};
  const decimals = meta.decimals ?? 2;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string | number>(initial ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(initial ?? ''); }, [initial]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const commit = async () => {
    const n = typeof draft === 'string' ? parseFloat(draft) : draft;
    setEditing(false);
    if (Number.isNaN(n) || n === initial) return;
    try {
      await table.options.meta?.updateCell?.(row.original, column.id, n);
    } catch (e) {
      notifications.show({ color: 'red', message: e instanceof Error ? e.message : '저장 실패' });
    }
  };

  if (editing) {
    return (
      <NumberInput
        ref={inputRef}
        size="xs"
        value={draft}
        onChange={(v) => setDraft(v)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setDraft(initial ?? ''); setEditing(false); }
        }}
        decimalScale={decimals}
        thousandSeparator=","
        hideControls
        styles={{ input: { textAlign: 'right', minHeight: 24, height: 24, padding: '0 6px', fontVariantNumeric: 'tabular-nums' } }}
      />
    );
  }

  const display = formatCellValue(initial, meta);
  return (
    <Box
      onClick={() => { setDraft(initial ?? ''); setEditing(true); }}
      style={{
        ...numberCellStyle,
        cursor: 'pointer',
        borderRadius: 4,
        minHeight: 24,
      }}
    >
      {display === '—' ? <Text c="dimmed" component="span">—</Text> : display}
    </Box>
  );
}

const defaultColumn: Partial<ColumnDef<MatrixRow>> = {
  cell: ReadOnlyNumberCell,
};

export default function Dashboard({ database, calculator }: DashboardProps) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [monthlyBills, setMonthlyBills] = useState<MonthlyBill[]>([]);
  const [unitBills, setUnitBills] = useState<UnitBill[]>([]);
  const [extraMonths, setExtraMonths] = useState<Array<{ year: number; month: number }>>([]);
  const [unitsModal, unitsModalCtl] = useDisclosure(false);
  const [addMonthModal, addMonthModalCtl] = useDisclosure(false);
  const [pwModal, pwModalCtl] = useDisclosure(false);

  const reload = useCallback(async () => {
    const [u, r, mb, ub] = await Promise.all([
      database.getUnits(),
      database.getAllMeterReadings(),
      database.getAllMonthlyBills(),
      database.getAllUnitBills(),
    ]);
    setUnits(u);
    setReadings(r);
    setMonthlyBills(mb);
    setUnitBills(ub);
  }, [database]);

  useEffect(() => { void reload(); }, [reload]);

  const matrixRows = useMemo<MatrixRow[]>(() => {
    const keyset = new Set<string>();
    const add = (y: number, m: number) => keyset.add(`${y}-${m}`);
    readings.forEach((r) => add(r.year, r.month));
    monthlyBills.forEach((b) => add(b.year, b.month));
    extraMonths.forEach((e) => add(e.year, e.month));

    const months = Array.from(keyset)
      .map((k) => {
        const [y, m] = k.split('-').map(Number);
        return { year: y, month: m };
      })
      .sort((a, b) => (b.year - a.year) || (b.month - a.month));

    const readingsKey = (uid: string, y: number, m: number) => `${uid}-${y}-${m}`;
    const readingMap = new Map<string, MeterReading>();
    readings.forEach((r) => readingMap.set(readingsKey(r.unit_id, r.year, r.month), r));
    const monthlyMap = new Map<string, MonthlyBill>();
    monthlyBills.forEach((b) => monthlyMap.set(`${b.year}-${b.month}`, b));
    const unitBillMap = new Map<string, UnitBill>();
    unitBills.forEach((b) => unitBillMap.set(readingsKey(b.unit_id, b.year, b.month), b));

    const prevYM = (y: number, m: number) => {
      const pm = m - 1 || 12;
      const py = m - 1 ? y : y - 1;
      return { year: py, month: pm };
    };

    return months.map(({ year, month }) => {
      const readingsByUnit: Record<string, MeterReading | undefined> = {};
      const prevReadingsByUnit: Record<string, MeterReading | undefined> = {};
      const unitBillsByUnit: Record<string, UnitBill | undefined> = {};
      units.forEach((u) => {
        readingsByUnit[u.id] = readingMap.get(readingsKey(u.id, year, month));
        const p = prevYM(year, month);
        prevReadingsByUnit[u.id] = readingMap.get(readingsKey(u.id, p.year, p.month));
        unitBillsByUnit[u.id] = unitBillMap.get(readingsKey(u.id, year, month));
      });
      return {
        year,
        month,
        monthlyBill: monthlyMap.get(`${year}-${month}`) ?? null,
        readingsByUnit,
        prevReadingsByUnit,
        unitBillsByUnit,
      };
    });
  }, [units, readings, monthlyBills, unitBills, extraMonths]);

  const recalcMonth = useCallback(async (year: number, month: number) => {
    const mb = monthlyBills.find((b) => b.year === year && b.month === month);
    if (!mb) return;
    await calculator.calculateAndSaveBills(
      year,
      month,
      mb.total_electricity_cost,
      mb.total_water_cost,
      mb.total_management_cost,
    );
  }, [calculator, monthlyBills]);

  const saveReading = useCallback(async (
    unitId: string,
    year: number,
    month: number,
    field: 'electricity_reading' | 'water_reading',
    value: number,
  ) => {
    const existing = readings.find((r) => r.unit_id === unitId && r.year === year && r.month === month);
    const next: MeterReading = {
      unit_id: unitId,
      year,
      month,
      electricity_reading: existing?.electricity_reading ?? 0,
      water_reading: existing?.water_reading ?? 0,
      [field]: value,
    } as MeterReading;
    await database.saveMeterReading(next);
    await recalcMonth(year, month);
    await reload();
    notifications.show({ color: 'green', message: '저장됨', autoClose: 1200 });
  }, [database, readings, recalcMonth, reload]);

  const saveMonthlyTotal = useCallback(async (
    year: number,
    month: number,
    field: 'total_electricity_cost' | 'total_water_cost' | 'total_overall_cost',
    value: number,
  ) => {
    const existing = monthlyBills.find((b) => b.year === year && b.month === month);
    const merged = {
      total_electricity_cost: existing?.total_electricity_cost ?? 0,
      total_water_cost: existing?.total_water_cost ?? 0,
      total_overall_cost: existing?.total_overall_cost ?? 0,
      [field]: value,
    };
    const total_management_cost = Math.max(
      0,
      merged.total_overall_cost - merged.total_electricity_cost - merged.total_water_cost,
    );
    const next: MonthlyBill = {
      year,
      month,
      total_electricity_cost: merged.total_electricity_cost,
      total_water_cost: merged.total_water_cost,
      total_overall_cost: merged.total_overall_cost,
      total_management_cost,
    };
    await database.saveMonthlyBill(next);
    await calculator.calculateAndSaveBills(
      year,
      month,
      next.total_electricity_cost,
      next.total_water_cost,
      next.total_management_cost,
    );
    await reload();
    notifications.show({ color: 'green', message: '재계산 완료', autoClose: 1200 });
  }, [database, monthlyBills, calculator, reload]);

  const columnHelper = createColumnHelper<MatrixRow>();
  const columns = useMemo<ColumnDef<MatrixRow, unknown>[]>(() => {
    const cols: ColumnDef<MatrixRow, unknown>[] = [
      columnHelper.display({
        id: 'ym',
        header: '년월',
        cell: ({ row }) => (
          <Text fw={600} style={{ whiteSpace: 'nowrap' }}>
            {row.original.year}-{String(row.original.month).padStart(2, '0')}
          </Text>
        ),
      }) as ColumnDef<MatrixRow, unknown>,
    ];

    units.forEach((u) => {
      cols.push(columnHelper.group({
        id: `u-${u.id}-readings`,
        header: () => <span>{u.name} <Text component="span" c="dimmed" size="xs">({u.area}㎡)</Text></span>,
        columns: [
          columnHelper.accessor((r) => r.readingsByUnit[u.id]?.electricity_reading, {
            id: `read__${u.id}__electricity`,
            header: '전기 검침',
            cell: EditableNumberCell,
            meta: { decimals: 1, editable: true },
          }),
          columnHelper.accessor((r) => {
            const cur = r.readingsByUnit[u.id]?.electricity_reading;
            const prev = r.prevReadingsByUnit[u.id]?.electricity_reading;
            if (cur === undefined || prev === undefined) return undefined;
            return Math.max(0, cur - prev);
          }, {
            id: `${u.id}-elec-use`,
            header: '사용량 KWH',
            meta: { decimals: 1 },
          }),
          columnHelper.accessor((r) => r.readingsByUnit[u.id]?.water_reading, {
            id: `read__${u.id}__water`,
            header: '수도 검침',
            cell: EditableNumberCell,
            meta: { decimals: 2, editable: true },
          }),
          columnHelper.accessor((r) => {
            const cur = r.readingsByUnit[u.id]?.water_reading;
            const prev = r.prevReadingsByUnit[u.id]?.water_reading;
            if (cur === undefined || prev === undefined) return undefined;
            return Math.max(0, cur - prev);
          }, {
            id: `${u.id}-water-use`,
            header: '사용량 m³',
            meta: { decimals: 2 },
          }),
        ],
      }) as ColumnDef<MatrixRow, unknown>);
    });

    cols.push(columnHelper.group({
      id: 'monthly-totals',
      header: '월별 총 요금',
      columns: [
        columnHelper.accessor((r) => r.monthlyBill?.total_electricity_cost, {
          id: 'total__electricity',
          header: '총 전기료',
          cell: EditableNumberCell,
          meta: { decimals: 0, currency: true, editable: true },
        }),
        columnHelper.accessor((r) => r.monthlyBill?.total_water_cost, {
          id: 'total__water',
          header: '총 수도료',
          cell: EditableNumberCell,
          meta: { decimals: 0, currency: true, editable: true },
        }),
        columnHelper.accessor((r) => r.monthlyBill?.total_overall_cost, {
          id: 'total__overall',
          header: '총 관리비',
          cell: EditableNumberCell,
          meta: { decimals: 0, currency: true, editable: true },
        }),
        columnHelper.accessor((r) => r.monthlyBill?.total_management_cost, {
          id: 'total__commonmgmt',
          header: () => (
            <Group gap={4} justify="center" wrap="nowrap">
              <span>공용관리비</span>
              <Tooltip label="총 관리비 − 총 전기료 − 총 수도료" withArrow>
                <IconInfoCircle size={14} style={{ cursor: 'help', opacity: 0.6 }} />
              </Tooltip>
            </Group>
          ),
          meta: { decimals: 0, currency: true },
        }),
      ],
    }) as ColumnDef<MatrixRow, unknown>);

    units.forEach((u) => {
      cols.push(columnHelper.group({
        id: `u-${u.id}-bills`,
        header: () => <span>{u.name} 청구</span>,
        columns: [
          columnHelper.accessor((r) => r.unitBillsByUnit[u.id]?.electricity_cost, {
            id: `${u.id}-bill-elec`,
            header: '전기료',
            meta: { currency: true },
          }),
          columnHelper.accessor((r) => r.unitBillsByUnit[u.id]?.water_cost, {
            id: `${u.id}-bill-water`,
            header: '수도료',
            meta: { currency: true },
          }),
          columnHelper.accessor((r) => r.unitBillsByUnit[u.id]?.management_cost, {
            id: `${u.id}-bill-mgmt`,
            header: '관리비',
            meta: { currency: true },
          }),
          columnHelper.accessor((r) => r.unitBillsByUnit[u.id]?.total_cost, {
            id: `${u.id}-bill-total`,
            header: '합계',
            cell: (ctx) => {
              const v = ctx.getValue() as number | undefined;
              return (
                <Box style={{ ...numberCellStyle, fontWeight: 700 }}>
                  {v ? krw(v) : <Text c="dimmed" component="span">—</Text>}
                </Box>
              );
            },
            meta: { currency: true },
          }),
        ],
      }) as ColumnDef<MatrixRow, unknown>);
    });

    return cols;
  }, [columnHelper, units]);

  const table = useReactTable({
    data: matrixRows,
    columns,
    defaultColumn,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      updateCell: async (row, columnId, value) => {
        if (columnId === 'total__electricity') {
          await saveMonthlyTotal(row.year, row.month, 'total_electricity_cost', value);
        } else if (columnId === 'total__water') {
          await saveMonthlyTotal(row.year, row.month, 'total_water_cost', value);
        } else if (columnId === 'total__overall') {
          await saveMonthlyTotal(row.year, row.month, 'total_overall_cost', value);
        } else {
          const m = columnId.match(/^read__(.+)__(electricity|water)$/);
          if (m) {
            const [, unitId, kind] = m;
            await saveReading(unitId, row.year, row.month, kind === 'electricity' ? 'electricity_reading' : 'water_reading', value);
          }
        }
      },
    },
  });

  const handleAddMonth = async (year: number, month: number) => {
    if (units.length === 0) {
      notifications.show({ color: 'red', message: '호실을 먼저 추가하세요' });
      return;
    }
    setExtraMonths((prev) => {
      if (prev.some((p) => p.year === year && p.month === month)) return prev;
      if (matrixRows.some((r) => r.year === year && r.month === month)) return prev;
      return [...prev, { year, month }];
    });
    addMonthModalCtl.close();
  };

  return (
    <>
      <Stack gap="md">
        <Group justify="space-between" className="no-print">
          <Group gap="xs">
            <Button leftSection={<IconPlus size={16} />} onClick={addMonthModalCtl.open} variant="default">
              월 추가
            </Button>
            <Button leftSection={<IconPencil size={16} />} onClick={unitsModalCtl.open} variant="default">
              호실 관리
            </Button>
            <Button leftSection={<IconPrinter size={16} />} onClick={() => window.print()} variant="default">
              인쇄
            </Button>
          </Group>
          <Group gap="sm">
            <Text c="dimmed" size="sm">
              셀 클릭 → 입력 → Enter / Tab 저장
            </Text>
            <Tooltip label="비밀번호 변경">
              <ActionIcon variant="subtle" onClick={pwModalCtl.open}><IconKey size={16} /></ActionIcon>
            </Tooltip>
            <Tooltip label="로그아웃">
              <ActionIcon variant="subtle" onClick={logoutAdmin}><IconLogout size={16} /></ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        <Box style={{ overflowX: 'auto', border: '1px solid var(--mantine-color-default-border)', borderRadius: 6 }}>
          <Table withColumnBorders withTableBorder={false} striped highlightOnHover>
            <Table.Thead>
              {table.getHeaderGroups().map((hg) => (
                <Table.Tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <Table.Th
                      key={h.id}
                      colSpan={h.colSpan}
                      style={{ textAlign: 'center', whiteSpace: 'nowrap', fontSize: 12, padding: '6px 8px' }}
                    >
                      {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                    </Table.Th>
                  ))}
                </Table.Tr>
              ))}
            </Table.Thead>
            <Table.Tbody>
              {table.getRowModel().rows.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={table.getAllLeafColumns().length} style={{ textAlign: 'center', padding: 24 }}>
                    <Text c="dimmed">데이터 없음. "월 추가"로 시작하세요.</Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <Table.Tr key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <Table.Td key={cell.id} style={{ padding: '4px 6px', fontSize: 13, whiteSpace: 'nowrap' }}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </Table.Td>
                    ))}
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </Box>
      </Stack>

      <UnitsModal
        opened={unitsModal}
        onClose={unitsModalCtl.close}
        database={database}
        units={units}
        onChanged={reload}
      />
      <AddMonthModal
        opened={addMonthModal}
        onClose={addMonthModalCtl.close}
        onAdd={handleAddMonth}
      />
      <PasswordChangeModal
        opened={pwModal}
        onClose={pwModalCtl.close}
        database={database}
      />
    </>
  );
}

function PasswordChangeModal({
  opened,
  onClose,
  database,
}: {
  opened: boolean;
  onClose: () => void;
  database: Database;
}) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!opened) { setCurrent(''); setNext(''); setConfirm(''); }
  }, [opened]);

  const submit = async () => {
    if (next !== confirm) {
      notifications.show({ color: 'red', message: '새 비밀번호 확인이 일치하지 않습니다' });
      return;
    }
    setSubmitting(true);
    try {
      await changeAdminPassword(database, current, next);
      notifications.show({ color: 'green', message: '비밀번호 변경됨', autoClose: 1500 });
      onClose();
    } catch (e) {
      notifications.show({ color: 'red', message: e instanceof Error ? e.message : '변경 실패' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="관리자 비밀번호 변경" size="sm">
      <Stack gap="sm">
        <PasswordInput label="현재 비밀번호" value={current} onChange={(e) => setCurrent(e.currentTarget.value)} autoFocus data-autofocus />
        <PasswordInput label="새 비밀번호" value={next} onChange={(e) => setNext(e.currentTarget.value)} />
        <PasswordInput label="새 비밀번호 확인" value={confirm} onChange={(e) => setConfirm(e.currentTarget.value)} />
        <Button onClick={submit} loading={submitting}>변경</Button>
      </Stack>
    </Modal>
  );
}

function UnitsModal({
  opened,
  onClose,
  database,
  units,
  onChanged,
}: {
  opened: boolean;
  onClose: () => void;
  database: Database;
  units: Unit[];
  onChanged: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<Record<string, { name: string; area: string }>>({});
  const [newUnit, setNewUnit] = useState({ id: '', name: '', area: '' });

  useEffect(() => {
    if (opened) {
      const next: Record<string, { name: string; area: string }> = {};
      units.forEach((u) => { next[u.id] = { name: u.name, area: String(u.area) }; });
      setDraft(next);
      setNewUnit({ id: '', name: '', area: '' });
    }
  }, [opened, units]);

  const saveExisting = async (id: string) => {
    const d = draft[id];
    const area = parseFloat(d.area);
    if (!d.name || Number.isNaN(area) || area <= 0) {
      notifications.show({ color: 'red', message: '입력값 확인' });
      return;
    }
    await database.upsertUnit({ id, name: d.name, area });
    await onChanged();
    notifications.show({ color: 'green', message: '저장됨', autoClose: 1200 });
  };

  const copyTenantLink = async (id: string) => {
    const url = `${window.location.origin}${window.location.pathname}?u=${encodeURIComponent(id)}`;
    try {
      await navigator.clipboard.writeText(url);
      notifications.show({ color: 'green', message: '링크 복사됨', autoClose: 1500 });
    } catch {
      window.prompt('수동으로 복사하세요', url);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm(`${id} 삭제? 관련 검침/청구도 모두 삭제됩니다.`)) return;
    await database.deleteUnit(id);
    await onChanged();
    notifications.show({ color: 'green', message: '삭제됨', autoClose: 1200 });
  };

  const addNew = async () => {
    const area = parseFloat(newUnit.area);
    if (!newUnit.id || !newUnit.name || Number.isNaN(area) || area <= 0) {
      notifications.show({ color: 'red', message: '모든 필드 입력' });
      return;
    }
    if (units.some((u) => u.id === newUnit.id)) {
      notifications.show({ color: 'red', message: '중복된 호실 ID' });
      return;
    }
    await database.upsertUnit({ id: newUnit.id, name: newUnit.name, area });
    setNewUnit({ id: '', name: '', area: '' });
    await onChanged();
    notifications.show({ color: 'green', message: '추가됨', autoClose: 1200 });
  };

  return (
    <Modal opened={opened} onClose={onClose} title="호실 관리" size="lg">
      <Stack gap="sm">
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>ID</Table.Th>
              <Table.Th>이름</Table.Th>
              <Table.Th>면적 (㎡)</Table.Th>
              <Table.Th>비밀번호</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {units.map((u) => (
              <Table.Tr key={u.id}>
                <Table.Td><Text fw={600}>{u.id}</Text></Table.Td>
                <Table.Td>
                  <TextInput
                    size="xs"
                    value={draft[u.id]?.name ?? ''}
                    onChange={(e) => setDraft({ ...draft, [u.id]: { ...draft[u.id], name: e.currentTarget.value } })}
                  />
                </Table.Td>
                <Table.Td>
                  <NumberInput
                    size="xs"
                    value={draft[u.id]?.area ?? ''}
                    onChange={(v) => setDraft({ ...draft, [u.id]: { ...draft[u.id], area: String(v) } })}
                    decimalScale={2}
                    hideControls
                  />
                </Table.Td>
                <Table.Td>
                  <UnitPasswordControl unit={u} database={database} onChanged={onChanged} />
                </Table.Td>
                <Table.Td>
                  <Group gap={4} wrap="nowrap">
                    <Tooltip label="입주자 페이지 링크 복사">
                      <ActionIcon variant="subtle" onClick={() => copyTenantLink(u.id)}><IconCopy size={16} /></ActionIcon>
                    </Tooltip>
                    <Tooltip label="저장"><ActionIcon variant="subtle" onClick={() => saveExisting(u.id)}><IconPencil size={16} /></ActionIcon></Tooltip>
                    <Tooltip label="삭제"><ActionIcon variant="subtle" color="red" onClick={() => remove(u.id)}><IconTrash size={16} /></ActionIcon></Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        <Title order={6} mt="md">새 호실 추가</Title>
        <Group grow align="end">
          <TextInput label="호실 ID" placeholder="예: 701" value={newUnit.id} onChange={(e) => setNewUnit({ ...newUnit, id: e.currentTarget.value })} />
          <TextInput label="이름" placeholder="예: 701호" value={newUnit.name} onChange={(e) => setNewUnit({ ...newUnit, name: e.currentTarget.value })} />
          <NumberInput label="면적 (㎡)" value={newUnit.area} onChange={(v) => setNewUnit({ ...newUnit, area: String(v) })} decimalScale={2} hideControls />
          <Button onClick={addNew} leftSection={<IconPlus size={16} />}>추가</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function UnitPasswordControl({
  unit,
  database,
  onChanged,
}: {
  unit: Unit;
  database: Database;
  onChanged: () => Promise<void>;
}) {
  const [opened, setOpened] = useState(false);
  const [pw, setPw] = useState('');
  const [saving, setSaving] = useState(false);

  const isSet = !!unit.password_hash;

  const save = async () => {
    if (!pw) {
      notifications.show({ color: 'red', message: '비밀번호를 입력하세요' });
      return;
    }
    setSaving(true);
    try {
      const hash = await sha256(pw);
      await database.setUnitPassword(unit.id, hash);
      await onChanged();
      notifications.show({ color: 'green', message: '비밀번호 설정됨', autoClose: 1500 });
      setPw('');
      setOpened(false);
    } catch (e) {
      notifications.show({ color: 'red', message: e instanceof Error ? e.message : '저장 실패' });
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    if (!window.confirm('비밀번호를 제거하시겠습니까? 입주자 페이지가 누구에게나 공개됩니다.')) return;
    setSaving(true);
    try {
      await database.setUnitPassword(unit.id, null);
      await onChanged();
      notifications.show({ color: 'green', message: '비밀번호 제거됨', autoClose: 1500 });
      setPw('');
      setOpened(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-start" withArrow shadow="md">
      <Popover.Target>
        <Button
          size="xs"
          variant={isSet ? 'light' : 'default'}
          leftSection={<IconKey size={14} />}
          onClick={() => setOpened((o) => !o)}
        >
          {isSet ? <Badge size="xs" variant="filled" color="green" mr={4}>설정됨</Badge> : '설정'}
          {isSet ? '변경' : ''}
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs" w={260}>
          <PasswordInput
            label={isSet ? '새 비밀번호' : '비밀번호'}
            value={pw}
            onChange={(e) => setPw(e.currentTarget.value)}
            autoFocus
            data-autofocus
          />
          <Group justify="space-between">
            {isSet ? (
              <Button size="xs" color="red" variant="subtle" onClick={clear} disabled={saving}>
                제거
              </Button>
            ) : <span />}
            <Button size="xs" onClick={save} loading={saving}>
              {isSet ? '변경' : '설정'}
            </Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

function AddMonthModal({
  opened,
  onClose,
  onAdd,
}: {
  opened: boolean;
  onClose: () => void;
  onAdd: (year: number, month: number) => void;
}) {
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);

  return (
    <Modal opened={opened} onClose={onClose} title="새 월 추가" size="sm">
      <Stack gap="sm">
        <Group grow>
          <NumberInput label="년도" value={year} onChange={(v) => setYear(Number(v))} min={2000} max={2100} hideControls />
          <NumberInput label="월" value={month} onChange={(v) => setMonth(Number(v))} min={1} max={12} hideControls />
        </Group>
        <Button onClick={() => onAdd(year, month)}>추가</Button>
        <Text c="dimmed" size="xs">빈 행이 추가됩니다. 셀을 클릭해 검침값을 입력하세요.</Text>
      </Stack>
    </Modal>
  );
}
