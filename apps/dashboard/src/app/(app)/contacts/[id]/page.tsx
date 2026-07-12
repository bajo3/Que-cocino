import { safe, db } from '../../../../lib/data';
import { SendBox } from '../../../../components/SendBox';
import { DeleteButton } from '../../../../components/DeleteButton';

export const dynamic = 'force-dynamic';

function List({ title, items }: { title: string; items: any }) {
  const arr: string[] = Array.isArray(items) ? items : [];
  if (arr.length === 0) return null;
  return (
    <div className="card">
      <div className="l">{title}</div>
      <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
        {arr.map((x, i) => (
          <li key={i}>{typeof x === 'string' ? x : JSON.stringify(x)}</li>
        ))}
      </ul>
    </div>
  );
}

export default async function ContactDetail({ params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id);
  const { data } = await safe(() => db.getContactDetail(id), null as any);
  if (!data) return <p className="muted">Contacto no encontrado o base de datos no disponible.</p>;

  const { contact, profile, tasks, messages, audios } = data;

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>{contact.name ?? contact.push_name ?? contact.id}</h2>
        <DeleteButton kind="contacts" id={id} />
      </div>
      <p className="muted">{contact.phone ?? ''} · prioridad {contact.priority_score}</p>

      {profile?.commercial_summary && (
        <div className="card section">
          <div className="l">Resumen comercial</div>
          <p>{profile.commercial_summary}</p>
        </div>
      )}

      <div className="cards section">
        <List title="Intereses" items={profile?.interests} />
        <List title="Vehículos" items={profile?.vehicles} />
        <List title="Promesas" items={profile?.promises} />
        <List title="Objeciones" items={profile?.objections} />
      </div>

      <SendBox target={id} targetType="contact" />

      <div className="section">
        <h3>Tareas</h3>
        <ul>
          {tasks.map((t: any) => (
            <li key={t.id}>
              <span className="badge">{t.status}</span> {t.title}
            </li>
          ))}
          {tasks.length === 0 && <li className="muted">Sin tareas.</li>}
        </ul>
      </div>

      <div className="section">
        <h3>Audios transcriptos</h3>
        <ul>
          {audios.map((a: any) => (
            <li key={a.id}>
              <span className="muted">{a.from_me ? 'Yo' : 'Contacto'}:</span> {a.transcript ?? `(${a.transcript_status})`}
            </li>
          ))}
          {audios.length === 0 && <li className="muted">Sin audios.</li>}
        </ul>
      </div>

      <div className="section">
        <h3>Últimos mensajes</h3>
        <table>
          <tbody>
            {messages.map((m: any) => (
              <tr key={m.id}>
                <td style={{ width: 160 }} className="muted">{m.timestamp ? new Date(m.timestamp).toLocaleString() : ''}</td>
                <td className={m.from_me ? 'mine' : ''}>{m.from_me ? 'Yo: ' : ''}{m.text_content ?? `[${m.message_type}]`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
