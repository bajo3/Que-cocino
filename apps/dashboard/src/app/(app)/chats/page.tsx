import Link from 'next/link';
import { safe, db } from '../../../lib/data';
import { chatLabel } from '../../../lib/chatLabel';
import { ReadToggle } from '../../../components/ReadToggle';

export const dynamic = 'force-dynamic';

export default async function ChatsPage() {
  const { data: chats } = await safe(() => db.listChats(500), [] as any[]);
  return (
    <div>
      <h2>Chats</h2>
      <p className="muted">
        Solo se guarda y analiza el contenido de los chats que habilites. Los demás se muestran únicamente para que
        puedas seleccionarlos.
      </p>
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Tipo</th>
            <th>Última actividad</th>
            <th>Prioridad</th>
            <th>Pendientes</th>
            <th>Estado</th>
            <th>Lectura</th>
          </tr>
        </thead>
        <tbody>
          {chats.map((chat: any) => (
            <tr key={chat.id}>
              <td>
                <Link href={`/chats/${encodeURIComponent(chat.id)}`}>{chatLabel(chat)}</Link>
                {!chat.display_name && chat.phone && <div className="muted">Identificado por teléfono</div>}
              </td>
              <td>{chat.is_group ? 'Grupo' : 'Privado'}</td>
              <td className="muted">
                {chat.last_message_at ? new Date(chat.last_message_at).toLocaleString() : '—'}
              </td>
              <td>
                {chat.priority_score > 0 ? <span className="badge hot">{chat.priority_score}</span> : chat.priority_score}
              </td>
              <td>{Number(chat.pending_tasks) || 0}</td>
              <td>{chat.last_from_me === false ? <span className="badge">⏳ falta responder</span> : ''}</td>
              <td>
                <div className="reading-cell">
                  <span className={`badge ${chat.read_enabled ? 'reading-on' : ''}`}>
                    {chat.read_enabled ? 'Leyendo' : 'Ignorado'}
                  </span>
                  <ReadToggle chatId={chat.id} enabled={!!chat.read_enabled} />
                </div>
              </td>
            </tr>
          ))}
          {chats.length === 0 && (
            <tr>
              <td colSpan={7} className="muted">
                Sin chats todavía. Al recibir actividad de WhatsApp aparecerán acá para que elijas cuáles leer.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
