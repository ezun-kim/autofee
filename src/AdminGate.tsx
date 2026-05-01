import { useEffect, useState, type ReactNode, type FormEvent } from 'react';
import { Button, Center, Loader, Paper, PasswordInput, Stack, Text, Title } from '@mantine/core';
import Database from './database/Database';
import { sha256 } from './utils/hash';

const STORAGE_KEY = 'autofee_admin_auth';
const SETTING_KEY = 'admin_password_hash';

export default function AdminGate({ database, children }: { database: Database; children: ReactNode }) {
  const [hash, setHash] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const h = await database.getSetting(SETTING_KEY);
        setHash(h);
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && h && stored === h) setAuthed(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [database]);

  if (loading) return <Center mih="60vh"><Loader /></Center>;
  if (authed) return <>{children}</>;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!hash) { setError('비밀번호가 설정되어 있지 않습니다. 관리자에게 문의하세요.'); return; }
    setSubmitting(true);
    try {
      const enteredHash = await sha256(pw);
      if (enteredHash === hash) {
        localStorage.setItem(STORAGE_KEY, enteredHash);
        setAuthed(true);
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
              <Title order={4}>관리자 로그인</Title>
              <Text size="xs" c="dimmed">관리자만 접근 가능합니다.</Text>
            </Stack>
            <PasswordInput
              label="비밀번호"
              value={pw}
              onChange={(e) => { setPw(e.currentTarget.value); setError(null); }}
              error={error}
              autoFocus
              data-autofocus
            />
            <Button type="submit" loading={submitting}>로그인</Button>
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}

export function logoutAdmin() {
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
}

export async function changeAdminPassword(database: Database, currentPw: string, newPw: string): Promise<void> {
  const currentHash = await database.getSetting(SETTING_KEY);
  const enteredHash = await sha256(currentPw);
  if (enteredHash !== currentHash) throw new Error('현재 비밀번호가 올바르지 않습니다.');
  if (newPw.length < 6) throw new Error('새 비밀번호는 6자 이상이어야 합니다.');
  const newHash = await sha256(newPw);
  await database.setSetting(SETTING_KEY, newHash);
  localStorage.setItem(STORAGE_KEY, newHash);
}
