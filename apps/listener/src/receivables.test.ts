import { describe, expect, it } from 'vitest';
import {
  isReceivablesFollowUpQuery,
  isReceivablesQuery,
  isReceivablesSaveConfirmation,
  parseReceivablesClientName,
  parseReceivableAppend,
  parseReceivablesList,
} from './receivables.js';

describe('pending receivables conversation', () => {
  it('parses a multiline list and keeps each job description', () => {
    const parsed = parseReceivablesList(`Te paso unos trabajos que tengo pendientes para cobrar

Punto completo + opticas = 200k + 70k opticas
Palio adventure completo + opticas = 250k 50k opticas
Captiva Pulido = 80k`);

    expect(parsed).toEqual([
      {
        description: 'Punto completo + opticas',
        components: [
          { amount: 200000, currency: 'ARS' },
          { amount: 70000, currency: 'ARS' },
        ],
      },
      {
        description: 'Palio adventure completo + opticas',
        components: [
          { amount: 250000, currency: 'ARS' },
          { amount: 50000, currency: 'ARS' },
        ],
      },
      {
        description: 'Captiva Pulido',
        components: [{ amount: 80000, currency: 'ARS' }],
      },
    ]);
  });

  it('parses an append operation against a numbered item', () => {
    expect(parseReceivableAppend('al numero 2 palio adventure sumale retirado polarizado 2')).toEqual({
      index: 2,
      detail: 'retirado polarizado 2',
    });
  });

  it('recognizes receivable follow-up questions', () => {
    expect(isReceivablesQuery('cobros?')).toBe(true);
    expect(isReceivablesFollowUpQuery('como quedo todo')).toBe(true);
    expect(isReceivablesQuery('pendientes?')).toBe(false);
  });

  it('recognizes a save confirmation and a standalone client name', () => {
    expect(isReceivablesSaveConfirmation('cargalo como pendiente de cobrar')).toBe(true);
    expect(parseReceivablesClientName('Jesus diaz')).toBe('Jesus Diaz');
    expect(parseReceivablesClientName('dale')).toBeNull();
  });
});
