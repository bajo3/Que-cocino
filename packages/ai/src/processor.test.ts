import { describe, expect, it } from 'vitest';
import { AIProcessor } from './processor.js';

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
