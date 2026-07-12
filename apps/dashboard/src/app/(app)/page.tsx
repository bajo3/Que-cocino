import Link from 'next/link';
import { Redis } from 'ioredis';
import { safe, db } from '../../lib/data';

export const dynamic = 'force-dynamic';

type Task = {
  id: string;
  title: string;
  priority?: string | null;
  due_at?: string | null;
  chat_name?: string | null;
};

type FinanceEntry = {
  id: string;
  kind: 'income' | 'expense' | 'debt';
  amount: string | number;
  description: string;
  category?: string | null;
  occurred_at: string;
  status: string;
};

type AudioRow = {
  id: string;
  transcript_status: string;
  transcript?: string | null;
  chat_name?: string | null;
  created_at: string;
};

const money = (value: unknown) =>
  Number(value ?? 0).toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  });

export default async function Home() {
  const [{ data: counts, error }, listen, send, tasks, finances, entries, audios, health] = await Promise.all([
    safe(
      () => db.statusCounts(),
      { chats: 0, contacts: 0, pendingTasks: 0, hotLeads: 0, pendingAudios: 0, lastMessageAt: null as string | null },
    ),
    safe(() => db.isListenPaused(), false),
    safe(() => db.isSendPaused(), false),
    safe(() => db.listTasks('pending'), [] as Task[]),
    safe(() => db.financeSummary(), { income: 0, expenses: 0, pending_debt: 0 } as any),
    safe(() => db.listFinanceEntries(120), [] as FinanceEntry[]),
    safe(() => db.listAudios(8), [] as AudioRow[]),
    getSystemHealth(),
  ]);

  const pending = tasks.data as Task[];
  const financeEntries = (entries.data as FinanceEntry[]).filter((entry) => isCurrentMonth(entry.occurred_at) && entry.status !== 'cancelled');
  const income = Number(finances.data.income ?? 0);
  const expenses = Number(finances.data.expenses ?? 0);
  const debt = Number(finances.data.pending_debt ?? 0);
  const balance = income - expenses;
  const overdue = pending.filter((task) => task.due_at && new Date(task.due_at).getTime() < Date.now());
  const today = pending
    .filter((task) => task.due_at && isToday(task.due_at))
    .sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime());
  const incomeConcepts = groupByLabel(
    financeEntries.filter((entry) => entry.kind === 'income'),
    (entry) => entry.description,
  );
  const expenseCategories = groupByLabel(
    financeEntries.filter((entry) => entry.kind === 'expense'),
    (entry) => entry.category || 'Sin categoria',
  );
  const daily = dailySeries(financeEntries);

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Inicio</h2>
          <p className="muted">Vista rapida de plata, tareas, audios y estado del asistente.</p>
        </div>
        <span className={`badge ${health.ok ? 'status-ok' : 'status-bad'}`}>{health.ok ? 'Operativo' : 'Revisar'}</span>
      </div>

      {error && <p className="inline-error">No se pudo conectar a la base de datos: {error}</p>}

      <section className="home-hero section">
        <div className={`home-balance ${balance >= 0 ? 'is-good' : 'is-bad'}`}>
          <div className="l">Balance del mes</div>
          <strong>{money(balance)}</strong>
          <span>Ingresos {money(income)} - gastos {money(expenses)}</span>
        </div>
        <div className="home-actions">
          <QuickLink href="/finances" label="Finanzas" value={`${financeEntries.length} movimientos`} />
          <QuickLink href="/tasks" label="Pendientes" value={`${pending.length} activos`} warn={overdue.length > 0} />
          <QuickLink href="/calendar" label="Agenda" value={`${today.length} para hoy`} />
          <QuickLink href="/audios" label="Audios" value={`${counts.pendingAudios} por revisar`} warn={counts.pendingAudios > 0} />
        </div>
      </section>

      <div className="home-grid section">
        <section className="panel-block home-main-panel">
          <div className="section-head">
            <h3>Movimiento diario</h3>
            <span className="muted">Mes actual</span>
          </div>
          <MiniBalance data={daily} />
        </section>

        <section className="panel-block">
          <div className="section-head">
            <h3>Hoy</h3>
            <Link href="/calendar" className="muted">Calendario</Link>
          </div>
          <TaskList tasks={today.slice(0, 6)} empty="Sin tareas con horario para hoy." />
        </section>
      </div>

      <div className="home-grid section">
        <section className="panel-block">
          <div className="section-head">
            <h3>Ingresos</h3>
            <Link href="/finances" className="muted">Ver todo</Link>
          </div>
          <RankBars data={incomeConcepts} empty="Sin ingresos este mes." />
        </section>

        <section className="panel-block">
          <div className="section-head">
            <h3>Pendientes criticos</h3>
            <Link href="/tasks" className="muted">Abrir</Link>
          </div>
          <TaskList tasks={[...overdue, ...pending.filter((task) => !overdue.includes(task))].slice(0, 6)} empty="Sin pendientes urgentes." />
        </section>
      </div>

      <div className="home-grid section">
        <section className="panel-block">
          <div className="section-head">
            <h3>Gastos</h3>
            <span className="muted">{money(expenses)}</span>
          </div>
          <RankBars data={expenseCategories} empty="Sin gastos este mes." />
        </section>

        <section className="panel-block">
          <div className="section-head">
            <h3>Audios recientes</h3>
            <Link href="/audios" className="muted">Audios</Link>
          </div>
          <div className="home-audio-list">
            {(audios.data as AudioRow[]).slice(0, 5).map((audio) => (
              <div className="home-audio" key={audio.id}>
                <span className={`dot ${audio.transcript_status === 'done' ? 'ok' : 'bad'}`} />
                <div>
                  <strong>{audio.chat_name ?? 'Sin chat'}</strong>
                  <p className="muted">{audio.transcript?.slice(0, 90) || audio.transcript_status}</p>
                </div>
              </div>
            ))}
            {(audios.data as AudioRow[]).length === 0 && <p className="muted">Todavia no hay audios.</p>}
          </div>
        </section>
      </div>

      <section className="card section">
        <div className="section-head">
          <h3>Salud del sistema</h3>
          <span className="muted">WhatsApp, Redis, DB y colas</span>
        </div>
        <div className="health-grid">
          {health.items.map((item) => (
            <div className="health-item" key={item.label}>
              <span className={`dot ${item.ok ? 'ok' : 'bad'}`} />
              <div>
                <strong>{item.label}</strong>
                <div className="muted">{item.detail}</div>
              </div>
            </div>
          ))}
          <div className="health-item">
            <span className={`dot ${listen.data ? 'bad' : 'ok'}`} />
            <div>
              <strong>Escucha</strong>
              <div className="muted">{listen.data ? 'Pausada' : 'Activa'}</div>
            </div>
          </div>
          <div className="health-item">
            <span className={`dot ${send.data ? 'bad' : 'ok'}`} />
            <div>
              <strong>Envios</strong>
              <div className="muted">{send.data ? 'Pausados' : 'Activos'}</div>
            </div>
          </div>
          <div className="health-item">
            <span className="dot ok" />
            <div>
              <strong>Ultimo mensaje</strong>
              <div className="muted">{counts.lastMessageAt ? new Date(counts.lastMessageAt).toLocaleString('es-AR') : 'Sin datos'}</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function QuickLink({ href, label, value, warn = false }: { href: string; label: string; value: string; warn?: boolean }) {
  return (
    <Link className={`home-quick ${warn ? 'is-warn' : ''}`} href={href}>
      <span>{label}</span>
      <strong>{value}</strong>
    </Link>
  );
}

function TaskList({ tasks, empty }: { tasks: Task[]; empty: string }) {
  if (tasks.length === 0) return <p className="muted">{empty}</p>;
  return (
    <div className="home-task-list">
      {tasks.map((task) => (
        <div className="home-task" key={task.id}>
          <div>
            <strong>{task.title}</strong>
            <p className="muted">{task.chat_name ?? 'Sin chat'}</p>
          </div>
          <span className={`badge priority-${task.priority ?? 'normal'}`}>
            {task.due_at ? new Date(task.due_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : task.priority ?? 'normal'}
          </span>
        </div>
      ))}
    </div>
  );
}

function MiniBalance({ data }: { data: { label: string; income: number; expense: number; balance: number }[] }) {
  const max = Math.max(1, ...data.flatMap((item) => [item.income, item.expense]));
  if (data.length === 0) return <p className="muted">Sin movimientos para graficar.</p>;
  return (
    <div className="mini-balance">
      {data.map((item) => (
        <div className="mini-day" key={item.label} title={`${item.label}: ${money(item.balance)}`}>
          <span className="mini-income" style={{ height: `${Math.max(5, (item.income / max) * 100)}%` }} />
          <span className="mini-expense" style={{ height: `${Math.max(5, (item.expense / max) * 100)}%` }} />
          <small>{item.label}</small>
        </div>
      ))}
    </div>
  );
}

function RankBars({ data, empty }: { data: { label: string; value: number }[]; empty: string }) {
  const max = Math.max(1, ...data.map((item) => item.value));
  if (data.length === 0) return <p className="muted">{empty}</p>;
  return (
    <div className="rank-bars compact-rank">
      {data.slice(0, 5).map((item) => (
        <div className="rank-row" key={item.label}>
          <div className="spread">
            <span>{item.label}</span>
            <strong>{money(item.value)}</strong>
          </div>
          <div className="rank-track"><span style={{ width: `${Math.max(3, (item.value / max) * 100)}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

async function getSystemHealth() {
  const [database, redis, listener] = await Promise.all([checkDatabase(), checkRedis(), checkListener()]);
  const queuesDisabled = String(process.env.DISABLE_REDIS_QUEUES ?? 'false').toLowerCase() === 'true';
  const items = [
    { label: 'Base de datos', ok: database.ok, detail: database.detail },
    { label: 'Redis / colas', ok: redis.ok && !queuesDisabled, detail: queuesDisabled ? 'Colas pausadas' : redis.detail },
    { label: 'WhatsApp listener', ok: listener.ok, detail: listener.detail },
  ];
  return { ok: items.every((item) => item.ok), items };
}

async function checkDatabase() {
  try {
    await db.query('select 1');
    return { ok: true, detail: 'Conectada' };
  } catch (error) {
    return { ok: false, detail: (error as Error).message };
  }
}

async function checkRedis() {
  const url = process.env.REDIS_URL;
  if (!url) return { ok: false, detail: 'REDIS_URL no configurado' };
  const redis = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
  try {
    await redis.connect();
    const pong = await redis.ping();
    return { ok: pong === 'PONG', detail: pong === 'PONG' ? 'Activo' : 'Sin respuesta' };
  } catch (error) {
    return { ok: false, detail: (error as Error).message };
  } finally {
    redis.disconnect();
  }
}

async function checkListener() {
  const rawUrl = process.env.LISTENER_URL ?? process.env.RAILWAY_SERVICE_LISTENER_URL;
  if (!rawUrl) return { ok: false, detail: 'URL no configurada' };
  const baseUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
  try {
    const response = await fetch(`${baseUrl}/health`, { cache: 'no-store' });
    const payload = await response.json();
    return { ok: response.ok && payload.connected === true, detail: payload.connected ? 'WhatsApp conectado' : 'Sin conectar' };
  } catch (error) {
    return { ok: false, detail: (error as Error).message };
  }
}

function isCurrentMonth(value: string) {
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function isToday(value: string) {
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

function groupByLabel(entries: FinanceEntry[], label: (entry: FinanceEntry) => string) {
  const map = new Map<string, number>();
  for (const entry of entries) {
    const key = label(entry).trim() || 'Sin detalle';
    map.set(key, (map.get(key) ?? 0) + Number(entry.amount ?? 0));
  }
  return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

function dailySeries(entries: FinanceEntry[]) {
  const map = new Map<string, { label: string; income: number; expense: number; balance: number }>();
  for (const entry of entries) {
    const date = new Date(entry.occurred_at);
    const label = String(date.getDate()).padStart(2, '0');
    const row = map.get(label) ?? { label, income: 0, expense: 0, balance: 0 };
    const amount = Number(entry.amount ?? 0);
    if (entry.kind === 'income') row.income += amount;
    if (entry.kind === 'expense') row.expense += amount;
    row.balance = row.income - row.expense;
    map.set(label, row);
  }
  return [...map.values()].sort((a, b) => Number(a.label) - Number(b.label));
}
