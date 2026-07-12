'use client';
import { useState } from 'react';

export default function LoginPage() {
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user, password }),
    });
    if (res.ok) {
      window.location.href = '/';
    } else {
      setError('Credenciales inválidas');
    }
  }

  return (
    <div className="center">
      <form className="login" onSubmit={submit}>
        <h1>📱 WA Memory</h1>
        <p className="muted">Panel privado</p>
        <div className="section">
          <label>Usuario</label>
          <input value={user} onChange={(e) => setUser(e.target.value)} autoFocus />
        </div>
        <div className="section">
          <label>Contraseña</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
        <button className="btn" type="submit" style={{ width: '100%' }}>
          Entrar
        </button>
      </form>
    </div>
  );
}
