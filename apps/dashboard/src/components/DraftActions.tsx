'use client';

import { useState } from 'react';

export function DraftActions({ id, initialText }: { id: string; initialText: string }) {
  const [text, setText] = useState(initialText);
  const [status, setStatus] = useState<'idle' | 'busy' | 'sent' | 'dismissed' | 'error'>('idle');

  async function act(action: 'send' | 'dismiss') {
    setStatus('busy');
    const response = await fetch(`/api/drafts/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, text }),
    });
    if (response.status === 401) {
      window.location.href = '/login';
      return;
    }
    setStatus(response.ok ? (action === 'send' ? 'sent' : 'dismissed') : 'error');
  }

  if (status === 'sent') return <span className="badge reading-on">Enviado</span>;
  if (status === 'dismissed') return <span className="badge">Descartado</span>;

  return (
    <div className="draft-actions">
      <textarea value={text} onChange={(event) => setText(event.target.value)} rows={3} />
      <div className="row">
        <button className="btn" disabled={status === 'busy' || !text.trim()} onClick={() => act('send')}>
          {status === 'busy' ? 'Procesando…' : 'Enviar'}
        </button>
        <button className="btn secondary" disabled={status === 'busy'} onClick={() => act('dismiss')}>
          Descartar
        </button>
        {status === 'error' && <span className="inline-error">No se pudo completar.</span>}
      </div>
    </div>
  );
}
