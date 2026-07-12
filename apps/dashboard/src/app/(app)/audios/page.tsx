import { safe, db } from '../../../lib/data';

export const dynamic = 'force-dynamic';

export default async function AudiosPage() {
  const { data: audios } = await safe(() => db.listAudios(100), [] as any[]);
  const done = audios.filter((audio: any) => audio.transcript_status === 'done').length;
  const pending = audios.filter((audio: any) => audio.transcript_status === 'pending').length;
  const failed = audios.filter((audio: any) => audio.transcript_status === 'error').length;
  const missingFile = audios.filter((audio: any) => audio.transcript_status === 'pending' && !audio.audio_url).length;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Audios</h2>
          <p className="muted">Transcripciones, estado de procesamiento y busqueda de mensajes hablados.</p>
        </div>
      </div>

      <div className="cards section">
        <div className="card metric"><div className="n">{done}</div><div className="l">Transcriptos</div></div>
        <div className="card metric"><div className="n">{pending}</div><div className="l">Pendientes</div></div>
        <div className="card metric"><div className="n">{failed}</div><div className="l">Con error</div></div>
        <div className="card metric"><div className="n">{missingFile}</div><div className="l">Sin archivo</div></div>
      </div>

      <section className="panel-block section">
        <div className="section-head">
          <h3>Buscar en audios</h3>
          <span className="muted">Usa tambien WhatsApp: /buscar-audios palabra</span>
        </div>
        <form action="/search" className="audio-search">
          <input name="q" placeholder="Ej: lavado, Jesus, precio" />
          <input type="hidden" name="audios" value="1" />
          <button className="btn">Buscar</button>
        </form>
      </section>

      <div className="table-wrap desktop-table">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Chat</th>
              <th>Origen</th>
              <th>Estado</th>
              <th>Transcripcion</th>
            </tr>
          </thead>
          <tbody>
            {audios.map((audio: any) => (
              <tr key={audio.id}>
                <td className="muted">{new Date(audio.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td><a href={`/chats/${encodeURIComponent(audio.chat_id)}`}>{audio.chat_name}</a></td>
                <td className="muted">{audio.from_me ? 'Yo' : 'Contacto'}</td>
                <td><AudioStatus audio={audio} /></td>
                <td>{audio.transcript ?? <span className="muted">{audio.audio_url ? 'Esperando transcripcion' : 'Audio no guardado'}</span>}</td>
              </tr>
            ))}
            {audios.length === 0 && <tr><td colSpan={5} className="muted">Sin audios todavia.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="mobile-list">
        {audios.map((audio: any) => (
          <article className="mobile-item" key={audio.id}>
            <div className="spread">
              <strong>{audio.chat_name}</strong>
              <AudioStatus audio={audio} />
            </div>
            <div className="mobile-item-meta">
              <span>{audio.from_me ? 'Yo' : 'Contacto'}</span>
              <span>{new Date(audio.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</span>
            </div>
            <p>{audio.transcript ?? <span className="muted">{audio.audio_url ? 'Esperando transcripcion' : 'Audio no guardado'}</span>}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function AudioStatus({ audio }: { audio: any }) {
  const missing = audio.transcript_status === 'pending' && !audio.audio_url;
  const label = missing ? 'sin archivo' : audio.transcript_status;
  const cls = audio.transcript_status === 'done' ? 'status-ok' : audio.transcript_status === 'error' || missing ? 'status-bad' : '';
  return <span className={`badge ${cls}`}>{label}</span>;
}
