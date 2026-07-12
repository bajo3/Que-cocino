import { describe, it, expect } from 'vitest';
import { parseCommandHeuristic } from './commandNlp.js';

describe('parseCommandHeuristic — slash commands', () => {
  it('parses /status', () => {
    expect(parseCommandHeuristic('/status').intent).toBe('status');
  });

  it('leaves control greetings for the conversational assistant', () => {
    expect(parseCommandHeuristic('hola').intent).toBe('unknown');
    expect(parseCommandHeuristic('estas ahi?').intent).toBe('unknown');
  });

  it('parses /resumen hoy', () => {
    expect(parseCommandHeuristic('/resumen hoy').intent).toBe('summary_today');
  });

  it('parses /clientes calientes', () => {
    expect(parseCommandHeuristic('/clientes calientes').intent).toBe('hot_leads');
  });

  it('parses /pendientes and /sin-responder', () => {
    expect(parseCommandHeuristic('/pendientes').intent).toBe('pending');
    expect(parseCommandHeuristic('/sin-responder').intent).toBe('unanswered');
  });

  it('parses pause/resume variants', () => {
    expect(parseCommandHeuristic('/pausar').intent).toBe('pause_listen');
    expect(parseCommandHeuristic('/reanudar').intent).toBe('resume_listen');
    expect(parseCommandHeuristic('/pausar-envios').intent).toBe('pause_send');
    expect(parseCommandHeuristic('/reanudar-envios').intent).toBe('resume_send');
  });

  it('distinguishes /buscar-audios from /buscar', () => {
    const a = parseCommandHeuristic('/buscar-audios vento rojo');
    expect(a.intent).toBe('search_audios');
    expect(a.query).toBe('vento rojo');
    const b = parseCommandHeuristic('/buscar financiacion');
    expect(b.intent).toBe('search');
    expect(b.query).toBe('financiacion');
  });

  it('parses /mandar <contacto>: <mensaje>', () => {
    const r = parseCommandHeuristic('/mandar Juan Pérez: hola, ¿cómo va?');
    expect(r.intent).toBe('send_message');
    expect(r.targetType).toBe('contact');
    expect(r.target).toBe('Juan Pérez');
    expect(r.message).toBe('hola, ¿cómo va?');
    expect(r.confidence).toBe(1);
  });

  it('parses /mandar-grupo <grupo>: <mensaje>', () => {
    const r = parseCommandHeuristic('/mandar-grupo Ventas: suban fotos');
    expect(r.intent).toBe('send_group');
    expect(r.targetType).toBe('group');
    expect(r.target).toBe('Ventas');
    expect(r.message).toBe('suban fotos');
  });
});

describe('parseCommandHeuristic — natural language', () => {
  it('parses "mandale a Juan Pérez que mañana le paso las fotos"', () => {
    const r = parseCommandHeuristic('mandale a Juan Pérez que mañana le paso las fotos');
    expect(r.intent).toBe('send_message');
    expect(r.target).toBe('Juan Pérez');
    expect(r.message.toLowerCase()).toContain('mañana');
    expect(r.message.toLowerCase()).toContain('te paso');
    expect(r.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('parses "avisale a Daniela que ya está lista la documentación"', () => {
    const r = parseCommandHeuristic('avisale a Daniela que ya está lista la documentación');
    expect(r.intent).toBe('send_message');
    expect(r.target).toBe('Daniela');
  });

  it('parses a group NL order', () => {
    const r = parseCommandHeuristic('mandale al grupo Ventas que suban foto y video de los vendidos');
    expect(r.intent).toBe('send_group');
    expect(r.targetType).toBe('group');
    expect(r.target).toBe('Ventas');
  });

  it('returns unknown for non-commands', () => {
    expect(parseCommandHeuristic('hola que tal').intent).toBe('unknown');
  });

  it('creates an undated pending task', () => {
    const r = parseCommandHeuristic('Pendiente subir historias Ventas Jesus');
    expect(r.intent).toBe('create_task');
    expect(r.task?.title).toBe('Subir historias Ventas Jesus');
    expect(r.task?.dueAt).toBeNull();
  });

  it('extracts tomorrow, time and a one-hour reminder', () => {
    const now = new Date(2026, 6, 3, 12, 0, 0);
    const r = parseCommandHeuristic(
      'Tarea subir historias Ventas Jesus mañana a las 10, avisame una hora antes',
      now,
    );
    expect(r.intent).toBe('create_task');
    expect(new Date(r.task!.dueAt!).getHours()).toBe(10);
    expect(new Date(r.task!.remindAt!).getHours()).toBe(9);
  });

  it('parses agenda today', () => {
    expect(parseCommandHeuristic('qué tengo hoy').intent).toBe('agenda_today');
    expect(parseCommandHeuristic('/agenda').intent).toBe('agenda_today');
  });
});

describe('parseCommandHeuristic - life assistant', () => {
  it('parses recurring tasks', () => {
    const result = parseCommandHeuristic('Tarea revisar caja cada semana');
    expect(result.intent).toBe('create_task');
    expect(result.task?.recurrence).toBe('weekly');
    expect(result.task?.title).toBe('Revisar caja');
  });

  it('parses expenses and income', () => {
    const expense = parseCommandHeuristic('gaste 15.000 en nafta');
    expect(expense.intent).toBe('finance_add');
    expect(expense.finance?.kind).toBe('expense');
    expect(expense.finance?.amount).toBe(15000);

    const income = parseCommandHeuristic('cobre 300000 venta');
    expect(income.finance?.kind).toBe('income');
  });

  it('parses dollar blue conversion queries', () => {
    const direct = parseCommandHeuristic('50 usd');
    expect(direct.intent).toBe('currency_convert');
    expect(direct.currency?.amount).toBe(50);

    const natural = parseCommandHeuristic('cuanto son 20 usd');
    expect(natural.intent).toBe('currency_convert');
    expect(natural.currency?.amount).toBe(20);
  });

  it('parses casual finance summary questions', () => {
    expect(parseCommandHeuristic('cuanto junte').intent).toBe('finance_summary');
    expect(parseCommandHeuristic('cuánto junté').intent).toBe('finance_summary');
    expect(parseCommandHeuristic('como van mis finanzas').intent).toBe('finance_summary');
    expect(parseCommandHeuristic('mis finanzas como van?').intent).toBe('finance_summary');
    expect(parseCommandHeuristic('como quedan mis finanzas ahora?').intent).toBe('finance_summary');
  });

  it('parses finance entries in USD', () => {
    const expense = parseCommandHeuristic('gaste 50 usd en repuestos');
    expect(expense.intent).toBe('finance_add');
    expect(expense.finance?.amount).toBe(50);
    expect(expense.finance?.currency).toBe('USD');
  });

  it('parses mixed ARS and USD finance entries with a description before amounts', () => {
    const income = parseCommandHeuristic('Ingreso jesus diaz $950k + 50 usd');
    expect(income.intent).toBe('finance_add');
    expect(income.finance?.kind).toBe('income');
    expect(income.finance?.description).toBe('Jesus diaz');
    expect(income.finance?.components).toEqual([
      { amount: 950000, currency: 'ARS' },
      { amount: 50, currency: 'USD' },
    ]);
  });

  it('parses k shorthand in ARS finance entries', () => {
    const expense = parseCommandHeuristic('gaste 12k nafta');
    expect(expense.intent).toBe('finance_add');
    expect(expense.finance?.amount).toBe(12000);
    expect(expense.finance?.description).toBe('Nafta');
  });

  it('parses subject-first payment entries', () => {
    const income = parseCommandHeuristic('jesus pago 950k y 50 usd');
    expect(income.intent).toBe('finance_add');
    expect(income.finance?.description).toBe('Jesus');
    expect(income.finance?.components).toEqual([
      { amount: 950000, currency: 'ARS' },
      { amount: 50, currency: 'USD' },
    ]);
  });

  it('parses million shorthand', () => {
    const income = parseCommandHeuristic('cobre 1.2m venta');
    expect(income.intent).toBe('finance_add');
    expect(income.finance?.amount).toBe(1200000);
    expect(income.finance?.description).toBe('Venta');
  });

  it('parses mixed expense and dollar debt formats', () => {
    const expense = parseCommandHeuristic('gasto repuestos 20 usd + 150k');
    expect(expense.intent).toBe('finance_add');
    expect(expense.finance?.kind).toBe('expense');
    expect(expense.finance?.description).toBe('Repuestos');

    const debt = parseCommandHeuristic('deuda juan 300 usd');
    expect(debt.intent).toBe('finance_add');
    expect(debt.finance?.kind).toBe('debt');
    expect(debt.finance?.currency).toBe('USD');
  });
});
