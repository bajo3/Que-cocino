'use client';

import { useState } from 'react';

export function FinanceForm() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(formData: FormData) {
    setBusy(true);
    setMessage('');
    const response = await fetch('/api/finances', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    });
    setBusy(false);
    if (response.status === 401) {
      window.location.href = '/login';
      return;
    }
    if (response.ok) {
      setMessage('Movimiento guardado.');
      window.location.reload();
    } else {
      setMessage('No se pudo guardar.');
    }
  }

  return (
    <form className="card form-grid section" action={submit}>
      <select name="kind" defaultValue="expense" aria-label="Tipo">
        <option value="expense">Gasto</option>
        <option value="income">Ingreso</option>
        <option value="debt">Deuda</option>
      </select>
      <input name="amount" type="number" min="0" step="0.01" placeholder="Importe" required />
      <input name="description" placeholder="Descripcion" required />
      <input name="category" placeholder="Categoria (opcional)" />
      <input name="occurredAt" type="datetime-local" aria-label="Fecha" />
      <select name="status" defaultValue="" aria-label="Estado">
        <option value="">Estado automatico</option>
        <option value="paid">Pagado</option>
        <option value="pending">Pendiente</option>
      </select>
      <button className="btn" disabled={busy}>{busy ? 'Guardando...' : 'Registrar'}</button>
      {message && <span className="muted">{message}</span>}
    </form>
  );
}
