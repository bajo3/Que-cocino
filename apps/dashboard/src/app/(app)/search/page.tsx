import { safe, db } from '../../../lib/data';

export const dynamic = 'force-dynamic';

export default async function SearchPage({ searchParams }: { searchParams: { q?: string; audios?: string } }) {
  const q = searchParams.q ?? '';
  const onlyAudio = searchParams.audios === '1';
  const { data: results } = q
    ? await safe(() => db.searchMessagesText(q, { onlyAudio, limit: 50 }), [] as any[])
    : { data: [] as any[] };

  return (
    <div>
      <h2>Búsqueda</h2>
      <form method="get" className="row section">
        <input name="q" defaultValue={q} placeholder="Buscar en mensajes…" />
        <label className="row" style={{ whiteSpace: 'nowrap' }}>
          <input type="checkbox" name="audios" value="1" defaultChecked={onlyAudio} style={{ width: 'auto' }} /> sólo audios
        </label>
        <button className="btn" type="submit">Buscar</button>
      </form>

      {q && (
        <table>
          <tbody>
            {results.map((r: any) => (
              <tr key={r.id}>
                <td className="muted" style={{ width: 200 }}>
                  <a href={`/chats/${encodeURIComponent(r.chat_id)}`}>{r.chat_name}</a>
                </td>
                <td>{onlyAudio ? r.transcript : r.text_content}</td>
              </tr>
            ))}
            {results.length === 0 && (
              <tr><td className="muted">Sin resultados para “{q}”.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
