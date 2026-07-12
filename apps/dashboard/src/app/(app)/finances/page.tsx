import { safe, db } from '../../../lib/data';
import { FinanceForm } from '../../../components/FinanceForm';
import { FinanceActions } from '../../../components/FinanceActions';

export const dynamic = 'force-dynamic';

const money = (value: unknown) =>
  Number(value ?? 0).toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  });

type Entry = {
  id: string;
  kind: 'income' | 'expense' | 'debt';
  amount: string | number;
  currency: string;
  category?: string | null;
  description: string;
  occurred_at: string;
  status: string;
};

export default async function FinancesPage() {
  const [{ data: entries }, { data: summary }] = await Promise.all([
    safe(() => db.listFinanceEntries(300), [] as Entry[]),
    safe(() => db.financeSummary(), { income: 0, expenses: 0, pending_debt: 0 } as any),
  ]);

  const financeEntries = entries as Entry[];
  const activeMonth = financeEntries.filter((entry) => isCurrentMonth(entry.occurred_at) && entry.status !== 'cancelled');
  const incomeEntries = activeMonth.filter((entry) => entry.kind === 'income');
  const expenseEntries = activeMonth.filter((entry) => entry.kind === 'expense');
  const debtEntries = activeMonth.filter((entry) => entry.kind === 'debt' && entry.status === 'pending');
  const balance = Number(summary.income ?? 0) - Number(summary.expenses ?? 0);
  const daily = dailySeries(activeMonth);
  const concept = groupByLabel(incomeEntries, (entry) => entry.description);
  const categories = groupByLabel(expenseEntries, (entry) => entry.category || 'Sin categoria');
  const biggestIncome = maxEntry(incomeEntries);
  const biggestExpense = maxEntry(expenseEntries);
  const projection = monthProjection(balance);
  const totalIncome = Number(summary.income ?? 0);

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Finanzas</h2>
          <p className="muted">Caja, conceptos, gastos y deudas en una sola vista.</p>
        </div>
      </div>

      <div className="cards section">
        <Metric label="Ingresos" value={money(summary.income)} hint={biggestIncome ? `Mayor: ${biggestIncome.description}` : 'Sin ingresos'} />
        <Metric label="Gastos" value={money(summary.expenses)} hint={biggestExpense ? `Mayor: ${biggestExpense.description}` : 'Sin gastos'} />
        <Metric label="Balance" value={money(balance)} hint={`Proyeccion: ${money(projection)}`} tone={balance >= 0 ? 'good' : 'bad'} />
        <Metric label="Deudas" value={money(summary.pending_debt)} hint={`${debtEntries.length} pendientes`} tone={debtEntries.length ? 'warn' : 'good'} />
      </div>

      <section className="finance-layout section">
        <div className="finance-main">
          <section className="panel-block">
            <div className="section-head">
              <h3>Balance diario</h3>
              <span className="muted">Mes actual</span>
            </div>
            <BalanceBars data={daily} />
          </section>

          <section className="panel-block">
            <div className="section-head">
              <h3>Ingresos por concepto</h3>
              <span className="muted">{money(totalIncome)}</span>
            </div>
            <RankBars data={concept} empty="Sin ingresos cargados este mes." />
          </section>
        </div>

        <aside className="finance-side">
          <section className="panel-block">
            <h3>Gastos por categoria</h3>
            <RankBars data={categories} empty="Sin gastos cargados este mes." compact />
          </section>
          <section className="panel-block">
            <h3>Lectura rapida</h3>
            <div className="insight-list">
              <Insight label="Movimientos" value={String(activeMonth.length)} />
              <Insight label="Ingresos registrados" value={String(incomeEntries.length)} />
              <Insight label="Gastos registrados" value={String(expenseEntries.length)} />
              <Insight label="Promedio diario" value={money(balance / Math.max(1, new Date().getDate()))} />
            </div>
          </section>
        </aside>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h3>Registrar movimiento</h3>
            <p className="muted">Tambien podes escribir por WhatsApp: gaste 15000 nafta, cobre 300k venta, deuda Juan 50 usd.</p>
          </div>
        </div>
        <FinanceForm />
      </section>

      <section className="section">
        <div className="section-head">
          <h3>Movimientos</h3>
          <span className="muted">{financeEntries.length} ultimos</span>
        </div>
        <div className="table-wrap desktop-table">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Descripcion</th>
                <th>Categoria</th>
                <th>Importe</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {financeEntries.map((entry) => (
                <tr key={entry.id} className={entry.status === 'cancelled' ? 'muted-row' : ''}>
                  <td className="muted">{new Date(entry.occurred_at).toLocaleDateString('es-AR')}</td>
                  <td><span className={`badge finance-${entry.kind}`}>{labelKind(entry.kind)}</span></td>
                  <td>{entry.description}</td>
                  <td className="muted">{entry.category ?? '-'}</td>
                  <td>{money(entry.amount)}</td>
                  <td><span className="badge">{entry.status}</span></td>
                  <td>
                    <FinanceActions
                      id={entry.id}
                      amount={Number(entry.amount ?? 0)}
                      description={entry.description}
                      category={entry.category}
                      status={entry.status}
                    />
                  </td>
                </tr>
              ))}
              {financeEntries.length === 0 && <tr><td colSpan={7} className="muted">Todavia no hay movimientos.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="mobile-list finance-mobile-list">
          {financeEntries.map((entry) => (
            <article className={`mobile-item ${entry.status === 'cancelled' ? 'muted-row' : ''}`} key={entry.id}>
              <div className="spread">
                <strong>{entry.description}</strong>
                <span className={`badge finance-${entry.kind}`}>{labelKind(entry.kind)}</span>
              </div>
              <div className="mobile-item-meta">
                <span>{money(entry.amount)}</span>
                <span>{new Date(entry.occurred_at).toLocaleDateString('es-AR')}</span>
                <span>{entry.category ?? 'Sin categoria'}</span>
              </div>
              <FinanceActions
                id={entry.id}
                amount={Number(entry.amount ?? 0)}
                description={entry.description}
                category={entry.category}
                status={entry.status}
              />
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'bad' | 'warn' }) {
  return (
    <div className={`card metric metric-${tone ?? 'neutral'}`}>
      <div className="n">{value}</div>
      <div className="l">{label}</div>
      {hint && <div className="metric-hint">{hint}</div>}
    </div>
  );
}

function Insight({ label, value }: { label: string; value: string }) {
  return (
    <div className="insight-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function BalanceBars({ data }: { data: { label: string; income: number; expense: number; balance: number }[] }) {
  const max = Math.max(1, ...data.flatMap((item) => [item.income, item.expense, Math.abs(item.balance)]));
  if (data.length === 0) return <p className="muted">Sin datos para graficar.</p>;
  return (
    <div className="balance-chart">
      {data.map((item) => (
        <div className="balance-day" key={item.label} title={`${item.label}: ${money(item.balance)}`}>
          <div className="balance-bars">
            <span className="bar-income" style={{ height: `${Math.max(4, (item.income / max) * 100)}%` }} />
            <span className="bar-expense" style={{ height: `${Math.max(4, (item.expense / max) * 100)}%` }} />
          </div>
          <span className="balance-label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function RankBars({ data, empty, compact = false }: { data: { label: string; value: number }[]; empty: string; compact?: boolean }) {
  const max = Math.max(1, ...data.map((item) => item.value));
  if (data.length === 0) return <p className="muted">{empty}</p>;
  return (
    <div className={`rank-bars ${compact ? 'compact-rank' : ''}`}>
      {data.slice(0, compact ? 6 : 10).map((item) => (
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

function isCurrentMonth(value: string) {
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function groupByLabel(entries: Entry[], label: (entry: Entry) => string) {
  const map = new Map<string, number>();
  for (const entry of entries) {
    const key = label(entry).trim() || 'Sin detalle';
    map.set(key, (map.get(key) ?? 0) + Number(entry.amount ?? 0));
  }
  return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

function dailySeries(entries: Entry[]) {
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

function maxEntry(entries: Entry[]) {
  return entries.reduce<Entry | null>((best, entry) => {
    if (!best || Number(entry.amount ?? 0) > Number(best.amount ?? 0)) return entry;
    return best;
  }, null);
}

function monthProjection(balance: number) {
  const now = new Date();
  const day = Math.max(1, now.getDate());
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return (balance / day) * days;
}

function labelKind(kind: Entry['kind']) {
  if (kind === 'income') return 'Ingreso';
  if (kind === 'expense') return 'Gasto';
  return 'Deuda';
}
