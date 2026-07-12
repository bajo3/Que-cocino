import { safe, db } from '../../../lib/data';
import { TaskDone } from '../../../components/TaskRow';

export const dynamic = 'force-dynamic';

function TaskList({ tasks, empty }: { tasks: any[]; empty: string }) {
  if (tasks.length === 0) return <p className="muted">{empty}</p>;
  return (
    <div className="task-list">
      {tasks.map((task) => (
        <article className="task-card" key={task.id}>
          <div className="task-copy">
            <div className="spread">
              <strong>{task.title}</strong>
              <span className={`badge priority-${task.priority ?? 'normal'}`}>{task.priority ?? 'normal'}</span>
            </div>
            <div className="muted">
              {task.due_at
                ? new Date(task.due_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
                : 'Sin fecha'}
              {task.project ? ` - ${task.project}` : ''}
            </div>
            {task.remind_at && (
              <div className="reminder-label">
                Aviso {new Date(task.remind_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
              </div>
            )}
          </div>
          <TaskDone id={task.id} />
        </article>
      ))}
    </div>
  );
}

export default async function CalendarPage() {
  const { data: tasks } = await safe(() => db.listTasks('pending'), [] as any[]);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const tomorrow = new Date(start);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(start);
  nextWeek.setDate(nextWeek.getDate() + 8);

  const dated = tasks.filter((task: any) => task.due_at);
  const overdue = dated.filter((task: any) => new Date(task.due_at) < start);
  const today = dated.filter((task: any) => {
    const due = new Date(task.due_at);
    return due >= start && due < tomorrow;
  });
  const upcoming = dated.filter((task: any) => {
    const due = new Date(task.due_at);
    return due >= tomorrow && due < nextWeek;
  });
  const later = dated.filter((task: any) => new Date(task.due_at) >= nextWeek);
  const someday = tasks.filter((task: any) => !task.due_at);

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Calendario</h2>
          <p className="muted">Agenda por prioridad: atrasadas, hoy, proximos dias y sin fecha.</p>
        </div>
      </div>

      <div className="cards section">
        <div className="card metric"><div className="n">{today.length}</div><div className="l">Hoy</div></div>
        <div className="card metric metric-bad"><div className="n">{overdue.length}</div><div className="l">Atrasadas</div></div>
        <div className="card metric"><div className="n">{upcoming.length}</div><div className="l">Proximos 7 dias</div></div>
        <div className="card metric"><div className="n">{someday.length}</div><div className="l">Sin fecha</div></div>
      </div>

      <div className="calendar-columns">
        <section className="panel-block calendar-section overdue">
          <div className="section-head"><h3>Atrasadas</h3><span className="badge">{overdue.length}</span></div>
          <TaskList tasks={overdue} empty="No hay tareas atrasadas." />
        </section>
        <section className="panel-block calendar-section">
          <div className="section-head"><h3>Hoy</h3><span className="badge">{today.length}</span></div>
          <TaskList tasks={today} empty="Nada programado para hoy." />
        </section>
        <section className="panel-block calendar-section">
          <div className="section-head"><h3>Proximos 7 dias</h3><span className="badge">{upcoming.length}</span></div>
          <TaskList tasks={upcoming} empty="Sin tareas proximas." />
        </section>
        <section className="panel-block calendar-section">
          <div className="section-head"><h3>Sin fecha</h3><span className="badge">{someday.length}</span></div>
          <TaskList tasks={someday} empty="No hay tareas sin fecha." />
        </section>
      </div>

      {later.length > 0 && (
        <section className="panel-block section">
          <div className="section-head"><h3>Mas adelante</h3><span className="badge">{later.length}</span></div>
          <TaskList tasks={later} empty="" />
        </section>
      )}
    </div>
  );
}
