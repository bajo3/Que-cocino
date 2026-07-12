'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function ReadToggle({ chatId, enabled }: { chatId: string; enabled: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function toggle() {
    setPending(true);
    setError('');
    try {
      const response = await fetch(`/api/chats/${encodeURIComponent(chatId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ readEnabled: !enabled }),
      });
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? 'No se pudo cambiar el permiso');
      }
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="read-toggle">
      <button
        type="button"
        className={`btn ${enabled ? 'danger' : ''}`}
        disabled={pending}
        onClick={toggle}
        aria-busy={pending}
        aria-label={enabled ? 'Dejar de leer este chat' : 'Empezar a leer este chat'}
      >
        {pending ? 'Guardando…' : enabled ? 'Dejar de leer' : 'Leer este chat'}
      </button>
      {error && <span className="inline-error" role="alert">{error}</span>}
    </span>
  );
}
