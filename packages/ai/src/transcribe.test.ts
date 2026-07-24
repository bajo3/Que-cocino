import { describe, expect, it } from 'vitest';
import { hasUnexpectedWritingSystem } from './transcribe.js';

describe('transcription quality guard', () => {
  it('accepts Spanish transcripts with names and accents', () => {
    expect(
      hasUnexpectedWritingSystem(
        'Feli, hay que bajar a cincuenta y ocho mil dólares la Sprinter motorhome.',
      ),
    ).toBe(false);
  });

  it('rejects Chinese and Cyrillic hallucinations', () => {
    expect(hasUnexpectedWritingSystem('耶稣，太多人等待他了。我明天再见吧。')).toBe(true);
    expect(hasUnexpectedWritingSystem('Сэй, прмо, вандия, тысячи мы, килна.')).toBe(true);
  });

  it('does not reject an isolated foreign character in otherwise Spanish text', () => {
    expect(hasUnexpectedWritingSystem('El modelo X está disponible y vale 58.000 USD.')).toBe(false);
  });
});
