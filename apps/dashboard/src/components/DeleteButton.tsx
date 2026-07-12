'use client';
import { useState } from 'react';

export function DeleteButton({ kind, id }: { kind: 'chats' | 'contacts'; id: string }) {
  const [busy, setBusy] = useState(false);
  async function del() {
    if (!confirm('¿Borrar todos los datos de este ' + (kind === 'chats' ? 'chat' : 'contacto') + '?')) return;
    setBusy(true);
    const res = await fetch(`/api/${kind}/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' });
    setBusy(false);
    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }
    if (res.ok) window.location.href = `/${kind}`;
    else alert('Error al borrar');
  }
  return (
    <button className="btn danger" disabled={busy} onClick={del}>
      {busy ? 'Borrando…' : 'Borrar datos'}
    </button>
  );
}
