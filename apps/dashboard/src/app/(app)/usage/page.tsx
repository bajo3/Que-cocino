import { safe, db } from '../../../lib/data';

export const dynamic = 'force-dynamic';

function number(value: unknown) {
  return Number(value ?? 0).toLocaleString('es-AR');
}

export default async function UsagePage() {
  const { data } = await safe(
    () => db.aiUsageSummary(30),
    { totals: { calls: 0, input_tokens: 0, output_tokens: 0, cached_input_tokens: 0, cost_usd: 0 }, byModel: [] } as any,
  );
  return (
    <div>
      <h2>Uso de inteligencia artificial</h2>
      <p className="muted">Últimos 30 días. GLM‑4.7‑Flash figura con costo USD 0.</p>
      <div className="cards section">
        <div className="card"><div className="n">{number(data.totals.calls)}</div><div className="l">Llamadas</div></div>
        <div className="card"><div className="n">{number(data.totals.input_tokens)}</div><div className="l">Tokens entrada</div></div>
        <div className="card"><div className="n">{number(data.totals.output_tokens)}</div><div className="l">Tokens salida</div></div>
        <div className="card"><div className="n">USD {Number(data.totals.cost_usd ?? 0).toFixed(4)}</div><div className="l">Costo estimado</div></div>
      </div>
      <table>
        <thead><tr><th>Modelo</th><th>Función</th><th>Llamadas</th><th>Entrada</th><th>Salida</th><th>Costo</th></tr></thead>
        <tbody>
          {data.byModel.map((row: any) => (
            <tr key={`${row.model}-${row.feature}`}>
              <td>{row.model}</td><td>{row.feature}</td><td>{number(row.calls)}</td>
              <td>{number(row.input_tokens)}</td><td>{number(row.output_tokens)}</td>
              <td>USD {Number(row.cost_usd ?? 0).toFixed(4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
