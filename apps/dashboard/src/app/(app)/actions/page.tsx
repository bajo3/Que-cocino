import { safe, db } from '../../../lib/data';
import { ReprocessCommandButton } from '../../../components/ReprocessCommandButton';

export const dynamic = 'force-dynamic';

export default async function ActionsPage() {
  const [{ data: actions }, { data: commands }, { data: ownMessages }] = await Promise.all([
    safe(() => db.listActions(100), [] as any[]),
    safe(() => db.listCommandLogs(80), [] as any[]),
    safe(() => db.recentOwnTextMessages(80), [] as any[]),
  ]);
  const unlogged = ownMessages.filter((message: any) => !message.has_command_log).slice(0, 20);

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Acciones</h2>
          <p className="muted">Auditoria de envios, comandos y mensajes que se pueden reprocesar.</p>
        </div>
      </div>

      <section className="section">
        <div className="section-head">
          <h3>Comandos recientes</h3>
          <span className="muted">{commands.length} registros</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Fecha</th><th>Comando</th><th>Intento</th><th>Estado</th><th>Accion</th></tr>
            </thead>
            <tbody>
              {commands.map((c: any) => (
                <tr key={c.id}>
                  <td className="muted">{new Date(c.created_at).toLocaleString('es-AR')}</td>
                  <td>{c.command_text}</td>
                  <td><span className="badge">{c.parsed_intent ?? 'unknown'}</span></td>
                  <td className="muted">{c.error ?? c.status}</td>
                  <td><ReprocessCommandButton messageId={c.source_message_id} /></td>
                </tr>
              ))}
              {commands.length === 0 && <tr><td colSpan={5} className="muted">Sin comandos registrados.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h3>Mensajes propios sin comando registrado</h3>
          <span className="muted">Para recuperar mensajes ignorados</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Fecha</th><th>Mensaje</th><th>Chat</th><th>Accion</th></tr></thead>
            <tbody>
              {unlogged.map((m: any) => (
                <tr key={m.id}>
                  <td className="muted">{new Date(m.timestamp).toLocaleString('es-AR')}</td>
                  <td>{m.text_content}</td>
                  <td className="muted">{m.chat_name}</td>
                  <td><ReprocessCommandButton messageId={m.id} /></td>
                </tr>
              ))}
              {unlogged.length === 0 && <tr><td colSpan={4} className="muted">No hay mensajes pendientes para revisar.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="section-head">
          <h3>Envios y acciones</h3>
          <span className="muted">{actions.length} registros</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Fecha</th><th>Tipo</th><th>Estado</th><th>Destino</th><th>Confianza</th><th>Error</th></tr>
            </thead>
            <tbody>
              {actions.map((a: any) => (
                <tr key={a.id}>
                  <td className="muted">{new Date(a.created_at).toLocaleString('es-AR')}</td>
                  <td>{a.action_type}</td>
                  <td><span className="badge">{a.status}</span></td>
                  <td className="muted">{a.target_chat_id ?? '-'}</td>
                  <td>{a.confidence ?? '-'}</td>
                  <td className="muted">{a.error ?? ''}</td>
                </tr>
              ))}
              {actions.length === 0 && <tr><td colSpan={6} className="muted">Sin acciones registradas.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
