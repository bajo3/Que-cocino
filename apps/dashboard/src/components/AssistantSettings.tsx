'use client';

import { useState } from 'react';

export function AssistantSettings({
  dailySummaryEnabled,
  dailySummaryHour,
  draftRepliesEnabled,
}: {
  dailySummaryEnabled: boolean;
  dailySummaryHour: number;
  draftRepliesEnabled: boolean;
}) {
  const [summary, setSummary] = useState(dailySummaryEnabled);
  const [hour, setHour] = useState(dailySummaryHour);
  const [drafts, setDrafts] = useState(draftRepliesEnabled);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaved(false);
    const response = await fetch('/api/settings/assistant', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dailySummaryEnabled: summary, dailySummaryHour: hour, draftRepliesEnabled: drafts }),
    });
    if (response.status === 401) {
      window.location.href = '/login';
      return;
    }
    setSaved(response.ok);
  }

  return (
    <div className="card section">
      <h3>Asistente diario</h3>
      <label className="row"><input type="checkbox" checked={summary} onChange={(event) => setSummary(event.target.checked)} style={{ width: 'auto' }} /> Resumen diario por WhatsApp</label>
      <label>Hora del resumen<input type="number" min="0" max="23" value={hour} onChange={(event) => setHour(Number(event.target.value))} /></label>
      <label className="row"><input type="checkbox" checked={drafts} onChange={(event) => setDrafts(event.target.checked)} style={{ width: 'auto' }} /> Crear borradores con mi estilo</label>
      <div className="row"><button className="btn" onClick={save}>Guardar</button>{saved && <span className="muted">Guardado.</span>}</div>
    </div>
  );
}
