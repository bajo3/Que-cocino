import { safe, db } from '../../../lib/data';
import { TaskDone } from '../../../components/TaskRow';
import { TaskForm } from '../../../components/TaskForm';

export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const { data: tasks } = await safe(() => db.listTasks('pending'), [] as any[]);
  const high = tasks.filter((task: any) => ['high', 'urgent'].includes(task.priority)).length;
  const dated = tasks.filter((task: any) => task.due_at).length;
  const noDate = tasks.length - dated;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Pendientes</h2>
          <p className="muted">Tareas capturadas desde WhatsApp y creadas desde el dashboard.</p>
        </div>
      </div>

      <div className="cards section">
        <div className="card metric"><div className="n">{tasks.length}</div><div className="l">Pendientes</div></div>
        <div className="card metric metric-warn"><div className="n">{high}</div><div className="l">Alta prioridad</div></div>
        <div className="card metric"><div className="n">{dated}</div><div className="l">Con fecha</div></div>
        <div className="card metric"><div className="n">{noDate}</div><div className="l">Sin fecha</div></div>
      </div>

      <TaskForm />

      <div className="table-wrap desktop-table">
        <table>
          <thead>
            <tr>
              <th>Tarea</th>
              <th>Chat</th>
              <th>Prioridad</th>
              <th>Vence</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task: any) => (
              <tr key={task.id}>
                <td>{task.title}</td>
                <td className="muted">{task.chat_name}</td>
                <td>
                  <span className={`badge priority-${task.priority ?? 'normal'}`}>{task.priority}</span>
                  {task.recurrence && <span className="badge">{task.recurrence}</span>}
                </td>
                <td className="muted">{task.due_at ? new Date(task.due_at).toLocaleString('es-AR') : '-'}</td>
                <td><TaskDone id={task.id} /></td>
              </tr>
            ))}
            {tasks.length === 0 && <tr><td colSpan={5} className="muted">No hay pendientes.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="mobile-list">
        {tasks.map((task: any) => (
          <article className="mobile-item" key={task.id}>
            <div className="spread">
              <strong>{task.title}</strong>
              <span className={`badge priority-${task.priority ?? 'normal'}`}>{task.priority}</span>
            </div>
            <div className="mobile-item-meta">
              <span>{task.chat_name ?? 'Sin chat'}</span>
              <span>{task.due_at ? new Date(task.due_at).toLocaleString('es-AR') : 'Sin fecha'}</span>
              {task.recurrence && <span>{task.recurrence}</span>}
            </div>
            <TaskDone id={task.id} />
          </article>
        ))}
      </div>
    </div>
  );
}
