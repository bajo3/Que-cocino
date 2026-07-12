import { describe, it, expect } from 'vitest';
import { scoreCandidates, decideResolution } from './resolver.js';
import type { ContactSearchRow } from '@wma/db';

function row(partial: Partial<ContactSearchRow>): ContactSearchRow {
  return {
    contactId: partial.contactId ?? '111@s.whatsapp.net',
    chatId: partial.chatId ?? partial.contactId ?? '111@s.whatsapp.net',
    displayName: partial.displayName ?? partial.name ?? 'X',
    phone: partial.phone ?? null,
    name: partial.name ?? null,
    pushName: partial.pushName ?? null,
    alias: partial.alias ?? null,
    lastMessageAt: partial.lastMessageAt ?? null,
  };
}

describe('scoreCandidates', () => {
  it('ranks an exact name match highest', () => {
    const rows = [
      row({ contactId: 'a', name: 'Juan Pérez', displayName: 'Juan Pérez' }),
      row({ contactId: 'b', name: 'Juan Taller', displayName: 'Juan Taller' }),
    ];
    const ranked = scoreCandidates('Juan Pérez', rows);
    expect(ranked[0]!.contactId).toBe('a');
    expect(ranked[0]!.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('matches by phone suffix', () => {
    const rows = [row({ contactId: 'a', name: 'Juan', phone: '5492494111222', displayName: 'Juan' })];
    const ranked = scoreCandidates('111222', rows);
    expect(ranked[0]!.confidence).toBeGreaterThanOrEqual(0.9);
  });
});

describe('decideResolution', () => {
  it('resolves a single strong match', () => {
    const res = decideResolution([{ contactId: 'a', chatId: 'a', displayName: 'Juan Pérez', confidence: 0.96 }]);
    expect(res.status).toBe('resolved');
  });

  it('is ambiguous when two matches are close (several "Juan")', () => {
    const res = decideResolution([
      { contactId: 'a', chatId: 'a', displayName: 'Juan Pérez', confidence: 0.62 },
      { contactId: 'b', chatId: 'b', displayName: 'Juan Taller', confidence: 0.6 },
      { contactId: 'c', chatId: 'c', displayName: 'Juan Ranger', confidence: 0.6 },
    ]);
    expect(res.status).toBe('ambiguous');
  });

  it('reports not_found for no candidates', () => {
    expect(decideResolution([]).status).toBe('not_found');
  });
});
