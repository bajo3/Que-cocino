import type { ReactNode } from 'react';

const NAV = [
  ['/', 'Inicio'],
  ['/chats', 'Chats'],
  ['/tasks', 'Pendientes'],
  ['/calendar', 'Calendario'],
  ['/finances', 'Finanzas'],
  ['/actions', 'Acciones'],
  ['/drafts', 'Borradores'],
  ['/contacts', 'Contactos'],
  ['/hot-leads', 'Clientes calientes'],
  ['/audios', 'Audios'],
  ['/search', 'Busqueda'],
  ['/usage', 'Uso IA'],
  ['/settings', 'Config'],
];

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <strong>WA Memory</strong>
          <span>Panel operativo</span>
        </div>
        <nav className="nav" aria-label="Navegacion principal">
          {NAV.map(([href, label]) => (
            <a key={href} href={href}>{label}</a>
          ))}
        </nav>
        <form action="/api/logout" method="post">
          <button className="btn secondary full" type="submit">Salir</button>
        </form>
      </aside>

      <header className="mobile-top">
        <div className="brand">
          <strong>WA Memory</strong>
          <span>Panel operativo</span>
        </div>
        <form action="/api/logout" method="post">
          <button className="btn secondary compact" type="submit">Salir</button>
        </form>
      </header>
      <nav className="mobile-nav" aria-label="Navegacion mobile">
        {NAV.map(([href, label]) => (
          <a key={href} href={href}>{label}</a>
        ))}
      </nav>

      <main className="content">{children}</main>
    </div>
  );
}
