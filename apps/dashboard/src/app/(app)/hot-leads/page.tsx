import { safe, db } from '../../../lib/data';

export const dynamic = 'force-dynamic';

export default async function HotLeadsPage() {
  const { data: leads } = await safe(() => db.listHotLeads(50), [] as any[]);
  return (
    <div>
      <h2>Clientes calientes 🔥</h2>
      <table>
        <thead>
          <tr>
            <th>Contacto</th>
            <th>Score</th>
            <th>Última intención</th>
            <th>Resumen</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l: any) => (
            <tr key={l.id}>
              <td><a href={`/contacts/${encodeURIComponent(l.id)}`}>{l.display_name}</a></td>
              <td><span className="badge hot">{l.priority_score}</span></td>
              <td className="muted">{l.last_intent ?? '—'}</td>
              <td className="muted">{l.commercial_summary ?? ''}</td>
            </tr>
          ))}
          {leads.length === 0 && (
            <tr><td colSpan={4} className="muted">Sin clientes calientes por ahora.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
