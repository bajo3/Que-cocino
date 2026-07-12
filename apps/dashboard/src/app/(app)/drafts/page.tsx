import { safe, db } from '../../../lib/data';
import { DraftActions } from '../../../components/DraftActions';

export const dynamic = 'force-dynamic';

export default async function DraftsPage() {
  const { data: drafts, error } = await safe(() => db.listReplyDrafts('pending'), [] as any[]);
  return (
    <div>
      <h2>Borradores de respuesta</h2>
      <p className="muted">El asistente usa tu estilo y el contexto. Nada se envía hasta que lo apruebes.</p>
      {error && <p className="inline-error">{error}</p>}
      <div className="draft-list">
        {drafts.map((draft: any) => (
          <article className="card" key={draft.id}>
            <div className="row spread">
              <strong>{draft.chat_name}</strong>
              <span className="badge">{Math.round(Number(draft.confidence ?? 0) * 100)}% confianza</span>
            </div>
            <p className="muted source-message">Mensaje: {draft.source_text}</p>
            <DraftActions id={draft.id} initialText={draft.draft_text} />
          </article>
        ))}
        {drafts.length === 0 && <div className="card muted">No hay borradores pendientes.</div>}
      </div>
    </div>
  );
}
