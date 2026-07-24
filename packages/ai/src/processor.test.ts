import { describe, expect, it } from 'vitest';
import {
  AIProcessor,
  filterExplicitTasks,
  hasExplicitTaskSignal,
  validateAutonomousCommand,
} from './processor.js';

describe('AIProcessor.analyzeMessage', () => {
  it('combines classification and task detection in offline mode', async () => {
    const processor = new AIProcessor({ useMock: true });
    const result = await processor.analyzeMessage({
      text: 'Acordarte de tirar la basura primo',
      fromMe: false,
      isGroup: false,
    });

    expect(result.classification.class).toBeTruthy();
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]!.title).toBe('Tirar la basura');
  });
});

describe('high precision task gate', () => {
  it('rejects the false positives seen in ordinary outgoing conversation', () => {
    expect(hasExplicitTaskSignal('voy al cactus ya lo vendiste', true)).toBe(false);
    expect(hasExplicitTaskSignal('pero tranca avisame cuando subas', true)).toBe(false);
    expect(
      hasExplicitTaskSignal(
        'Dale, Jesús, no sé si trabajarán a la tarde pero voy para allá y lo hago ya',
        true,
      ),
    ).toBe(false);
  });

  it('accepts explicit obligations and direct requests', () => {
    expect(hasExplicitTaskSignal('Jesús, tengo que contestar a Ricky cómo se ve', true)).toBe(true);
    expect(
      hasExplicitTaskSignal('Feli, hay que bajar a cincuenta y ocho mil dólares la Sprinter motorhome', false),
    ).toBe(true);
  });

  it('requires exact evidence and sufficient model confidence', () => {
    const source = 'Feli, hay que bajar a 58.000 dólares la Sprinter motorhome.';
    const accepted = filterExplicitTasks(source, false, [
      {
        title: 'Bajar la Sprinter motorhome a USD 58.000',
        priority: 'high',
        dueAt: null,
        evidence: 'hay que bajar a 58.000 dólares la Sprinter motorhome',
        confidence: 0.95,
      },
      {
        title: 'Contactar al cliente para negociar',
        priority: 'normal',
        dueAt: null,
        evidence: 'contactar al cliente',
        confidence: 0.95,
      },
    ]);
    expect(accepted.map((task) => task.title)).toEqual(['Bajar la Sprinter motorhome a USD 58.000']);
  });
});

describe('AIProcessor.answerAssistant', () => {
  it('answers conversational finance questions in offline mode with context', async () => {
    const processor = new AIProcessor({ useMock: true });
    const result = await processor.answerAssistant({
      text: 'como van mis finanzas?',
      context: 'Balance: $ 100.000',
    });

    expect(result).toContain('Balance');
  });

  it('does not invent live weather in offline mode', async () => {
    const processor = new AIProcessor({ useMock: true });
    const result = await processor.answerAssistant({
      text: 'como esta el clima?',
    });

    expect(result).toContain('clima en vivo');
  });
});

describe('autonomous command validation', () => {
  it('accepts a confident natural task action', () => {
    const result = validateAutonomousCommand(
      {
        intent: 'create_task',
        confidence: 0.94,
        task: { title: 'Llamar a Ricky', dueAt: null },
      },
      'haceme una tarea para llamar a Ricky',
    );

    expect(result.intent).toBe('create_task');
    expect(result.task?.title).toBe('Llamar a Ricky');
  });

  it('rejects side effects when confidence is low', () => {
    const result = validateAutonomousCommand(
      {
        intent: 'finance_add',
        confidence: 0.62,
        finance: { kind: 'expense', amount: 50000, description: 'Algo' },
      },
      'hacelo',
    );

    expect(result.intent).toBe('unknown');
    expect(result.clarification).toContain('confirmes');
  });

  it('asks for the missing recipient instead of inventing it', () => {
    const result = validateAutonomousCommand(
      {
        intent: 'send_message',
        confidence: 0.96,
        message: 'Ya está listo',
      },
      'avisale que ya está listo',
    );

    expect(result.intent).toBe('unknown');
    expect(result.clarification).toContain('quién');
  });

  it('normalizes a valid finance action', () => {
    const result = validateAutonomousCommand(
      {
        intent: 'finance_add',
        confidence: 0.93,
        finance: { kind: 'income', amount: 270000, description: 'Punto completo' },
      },
      'cargame el cobro del Punto por 270k',
    );

    expect(result.intent).toBe('finance_add');
    expect(result.finance?.currency).toBe('ARS');
  });
});
