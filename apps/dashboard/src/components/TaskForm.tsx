'use client';

import { useState } from 'react';

export function TaskForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(formData: FormData) {
    setBusy(true);
    setError('');
    const response = await fetch('/api/tasks', {
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
    if (response.ok) window.location.reload();
    else setError('No se pudo crear la tarea.');
  }

  return (
    <form className="card form-grid section" action={submit}>
      <input name="title" placeholder="Nueva tarea" required />
      <input name="dueAt" type="datetime-local" aria-label="Vence" />
      <input name="remindAt" type="datetime-local" aria-label="Recordatorio" />
      <select name="priority" defaultValue="normal" aria-label="Prioridad">
        <option value="low">Baja</option>
        <option value="normal">Normal</option>
        <option value="high">Alta</option>
        <option value="urgent">Urgente</option>
      </select>
      <select name="recurrence" defaultValue="" aria-label="Repeticion">
        <option value="">No repetir</option>
        <option value="daily">Cada dia</option>
        <option value="weekly">Cada semana</option>
        <option value="monthly">Cada mes</option>
      </select>
      <input name="project" placeholder="Proyecto (opcional)" />
      <button className="btn" disabled={busy}>{busy ? 'Creando...' : 'Crear tarea'}</button>
      {error && <span className="inline-error">{error}</span>}
    </form>
  );
}
