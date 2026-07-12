import { safe, db } from '../../../lib/data';

export const dynamic = 'force-dynamic';

export default async function ContactsPage() {
  const { data: contacts } = await safe(() => db.listContacts(200), [] as any[]);
  return (
    <div>
      <h2>Contactos</h2>
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Teléfono</th>
            <th>Prioridad</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((c: any) => (
            <tr key={c.id}>
              <td>
                <a href={`/contacts/${encodeURIComponent(c.id)}`}>{c.name ?? c.push_name ?? c.business_name ?? c.id}</a>
              </td>
              <td className="muted">{c.phone ?? '—'}</td>
              <td>{c.priority_score > 0 ? <span className="badge hot">{c.priority_score}</span> : 0}</td>
            </tr>
          ))}
          {contacts.length === 0 && (
            <tr>
              <td colSpan={3} className="muted">Sin contactos todavía.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
