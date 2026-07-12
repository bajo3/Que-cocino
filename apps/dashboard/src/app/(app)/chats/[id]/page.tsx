import { safe, db } from '../../../../lib/data';
import { chatLabel } from '../../../../lib/chatLabel';
import { SendBox } from '../../../../components/SendBox';
import { DeleteButton } from '../../../../components/DeleteButton';
import { ReadToggle } from '../../../../components/ReadToggle';

export const dynamic = 'force-dynamic';

export default async function ChatDetail({ params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id);
  const { data } = await safe(() => db.getChatWithMessages(id, 60), null as any);
  if (!data) return <p className="muted">Chat no encontrado o base de datos no disponible.</p>;

  const { chat, messages, summary } = data;
  const isGroup = !!chat.is_group;

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>{chatLabel(chat)}</h2>
        <DeleteButton kind="chats" id={id} />
      </div>
      {chat.phone && <p className="muted">Teléfono: +{chat.phone}</p>}
      <div className="row section">
        <span className={`badge ${chat.read_enabled ? 'reading-on' : ''}`}>
          {chat.read_enabled ? 'Lectura activa' : 'Contenido ignorado'}
        </span>
        <ReadToggle chatId={id} enabled={!!chat.read_enabled} />
      </div>
      <p className="muted">{isGroup ? 'Grupo' : 'Privado'} · prioridad {chat.priority_score}</p>

      {summary?.summary && (
        <div className="card section">
          <div className="l">Resumen</div>
          <p>{summary.summary}</p>
        </div>
      )}

      <SendBox target={id} targetType={isGroup ? 'group' : 'contact'} />

      <h3>Mensajes</h3>
      <table>
        <tbody>
          {messages.map((m: any) => (
            <tr key={m.id}>
              <td style={{ width: 160 }} className="muted">
                {m.timestamp ? new Date(m.timestamp).toLocaleString() : ''}
              </td>
              <td className={m.from_me ? 'mine' : ''}>
                {m.from_me ? 'Yo: ' : ''}
                {m.text_content ?? <span className="muted">[{m.message_type}]</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
