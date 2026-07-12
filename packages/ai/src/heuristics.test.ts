import { describe, it, expect } from 'vitest';
import { classifyHeuristic, detectTasksHeuristic } from './heuristics.js';

describe('classifyHeuristic', () => {
  it('flags a price question as a hot-lead price inquiry', () => {
    const r = classifyHeuristic('Hola, qué precio tiene la Amarok?', false);
    expect(r.class).toBe('consulta_precio');
    expect(r.isHotLead).toBe(true);
  });

  it('detects financiación', () => {
    expect(classifyHeuristic('me podés pasar las cuotas y el plan de financiación?', false).class).toBe(
      'consulta_financiacion',
    );
  });

  it('treats "reservame" / "te transfiero" as urgent hot lead', () => {
    const r = classifyHeuristic('reservame la Hilux que te transfiero hoy', false);
    expect(r.isHotLead).toBe(true);
    expect(r.priority).toBe('urgent');
  });

  it('classifies a complaint as reclamo/urgent', () => {
    const r = classifyHeuristic('esto es un reclamo, el auto no funciona', false);
    expect(r.class).toBe('reclamo');
    expect(r.priority).toBe('urgent');
  });

  it('classifies small talk as ruido', () => {
    expect(classifyHeuristic('jajaja buenísimo', false).class).toBe('ruido');
  });

  it('does not mark my own messages as hot leads', () => {
    expect(classifyHeuristic('te paso el precio mañana', true).isHotLead).toBe(false);
  });
});

describe('detectTasksHeuristic', () => {
  it('detects a "mañana le paso las fotos" promise', () => {
    const tasks = detectTasksHeuristic('dale, mañana le paso las fotos', true);
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks[0]!.dueAt).toBeTruthy();
  });

  it('returns nothing for non-actionable text', () => {
    expect(detectTasksHeuristic('gracias!', false)).toHaveLength(0);
  });

  it('detects a direct reminder request without using an LLM', () => {
    const tasks = detectTasksHeuristic('Acordarte de tirar la basura primo', false);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]!.title).toBe('Tirar la basura');
  });
});
