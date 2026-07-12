'use client';

import { useState } from 'react';

export function ReprocessCommandButton({ messageId }: { messageId: string | null }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [detail, setDetail] = useState('');

  if (!messageId) return <span className="muted">Sin mensaje</span>;

  async function reprocess() {
    setState('busy');
    setDetail('');
    try {
      const response = await fetch('/api/commands/reprocess', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messageId }),
      });
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? 'No se pudo reprocesar.');
      setState('done');
      setDetail(payload.reply ? 'Respuesta enviada al chat.' : 'Reprocesado sin respuesta.');
    } catch (error) {
      setState('error');
      setDetail((error as Error).message);
    }
  }

  return (
    <div className="stack-xs">
      <button className="btn secondary compact" type="button" disabled={state === 'busy'} onClick={reprocess}>
        {state === 'busy' ? 'Procesando...' : 'Reprocesar'}
      </button>
      {detail && <span className={state === 'error' ? 'inline-error' : 'muted'}>{detail}</span>}
    </div>
  );
}
