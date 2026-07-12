'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function FinanceActions({
  id,
  amount,
  description,
  category,
  status,
}: {
  id: string;
  amount: number;
  description: string;
  category?: string | null;
  status: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/finances/${id}`, {
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
        throw new Error(payload.error ?? 'No se pudo actualizar.');
      }
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/finances/${id}`, { method: 'DELETE', credentials: 'include' });
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? 'No se pudo cancelar.');
      }
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <form
        className="inline-edit"
        action={(formData) =>
          patch({
            amount: formData.get('amount'),
            description: formData.get('description'),
            category: formData.get('category'),
          })
        }
      >
        <input name="amount" type="number" min="0" step="0.01" defaultValue={amount} aria-label="Importe" />
        <input name="description" defaultValue={description} aria-label="Descripcion" />
        <input name="category" defaultValue={category ?? ''} aria-label="Categoria" />
        <div className="task-actions">
          <button className="btn compact" disabled={busy}>
            Guardar
          </button>
          <button className="btn secondary compact" type="button" disabled={busy} onClick={() => setEditing(false)}>
            Cerrar
          </button>
        </div>
        {error && <span className="inline-error">{error}</span>}
      </form>
    );
  }

  return (
    <div className="stack-xs">
      <div className="task-actions">
        <button className="btn secondary compact" disabled={busy} onClick={() => setEditing(true)}>
          Editar
        </button>
        {status === 'cancelled' ? (
          <button className="btn secondary compact" disabled={busy} onClick={() => patch({ status: 'paid' })}>
            Restaurar
          </button>
        ) : (
          <button className="btn danger compact" disabled={busy} onClick={remove}>
            Cancelar
          </button>
        )}
      </div>
      {error && <span className="inline-error">{error}</span>}
    </div>
  );
}
