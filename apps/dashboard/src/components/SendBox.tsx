'use client';
import { useState } from 'react';

export function SendBox({ target, targetType }: { target: string; targetType: 'contact' | 'group' }) {
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!message.trim()) return;
    setBusy(true);
    setStatus(null);
    const res = await fetch('/api/send', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ target, targetType, message }),
    });
    setBusy(false);
    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }
    if (res.ok) {
      setStatus('Encolado para envío ✅');
      setMessage('');
    } else {
      const j = await res.json().catch(() => ({}));
      setStatus(`Error: ${j.error ?? res.status}`);
    }
  }

  return (
    <div className="section">
      <label className="muted">Enviar mensaje (requiere envíos activos)</label>
      <textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Escribí el mensaje…" />
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn" disabled={busy} onClick={send}>
          {busy ? 'Enviando…' : 'Enviar'}
        </button>
        {status && <span className="muted">{status}</span>}
      </div>
    </div>
  );
}
