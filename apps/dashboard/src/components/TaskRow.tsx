'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function TaskDone({ id }: { id: string }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  async function patch(body: Record<string, unknown>) {
    setError('');
    setState('busy');
    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? 'No se pudo actualizar la tarea.');
      }
      if (body.action === 'complete' || body.status === 'done') setState('done');
      else setState('idle');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setState('error');
    }
  }

  if (state === 'done') return <span className="badge status-ok">Hecha</span>;
  return (
    <>
      <div className="task-actions">
        <button className="btn secondary" disabled={state === 'busy'} onClick={() => patch({ action: 'complete' })}>
          {state === 'busy' ? 'Guardando...' : 'Hecha'}
        </button>
        <button
          className="btn secondary"
          disabled={state === 'busy'}
          onClick={() => patch({ action: 'snooze', until: new Date(Date.now() + 60 * 60 * 1000).toISOString() })}
        >
          +1 h
        </button>
        <button
          className="btn secondary"
          disabled={state === 'busy'}
          onClick={() => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(9, 0, 0, 0);
            void patch({ action: 'snooze', until: tomorrow.toISOString() });
          }}
        >
          Manana
        </button>
      </div>
      {error && <div className="task-error">{error}</div>}
    </>
  );
}
