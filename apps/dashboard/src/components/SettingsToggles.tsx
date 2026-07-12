'use client';
import { useState } from 'react';

function Toggle({ label, paused, onPath, offPath }: { label: string; paused: boolean; onPath: string; offPath: string }) {
  const [isPaused, setIsPaused] = useState(paused);
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    const res = await fetch(isPaused ? offPath : onPath, { method: 'POST', credentials: 'include' });
    setBusy(false);
    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }
    if (res.ok) setIsPaused(!isPaused);
  }
  return (
    <div className="card">
      <div className="l">{label}</div>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
        <span>{isPaused ? '⏸️ Pausado' : '▶️ Activo'}</span>
        <button className={`btn ${isPaused ? '' : 'secondary'}`} disabled={busy} onClick={toggle}>
          {busy ? '…' : isPaused ? 'Reanudar' : 'Pausar'}
        </button>
      </div>
    </div>
  );
}

export function SettingsToggles({ listenPaused, sendPaused }: { listenPaused: boolean; sendPaused: boolean }) {
  return (
    <div className="cards">
      <Toggle label="Escucha de mensajes" paused={listenPaused} onPath="/api/settings/pause" offPath="/api/settings/resume" />
      <Toggle label="Envío de mensajes" paused={sendPaused} onPath="/api/settings/pause-sending" offPath="/api/settings/resume-sending" />
    </div>
  );
}
