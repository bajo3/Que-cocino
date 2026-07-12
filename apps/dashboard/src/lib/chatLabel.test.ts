import { describe, expect, it } from 'vitest';
import { chatLabel } from './chatLabel';

describe('chatLabel', () => {
  it('prefers the resolved WhatsApp name', () => {
    expect(chatLabel({ id: '123@lid', display_name: 'Juan Pérez' })).toBe('Juan Pérez');
  });

  it('shows a mapped phone when no name is known', () => {
    expect(chatLabel({ id: '123@lid', phone: '5491112345678' })).toBe('+5491112345678');
  });

  it('uses understandable fallbacks for unresolved identities', () => {
    expect(chatLabel({ id: '123@lid' })).toBe('Contacto sin nombre · LID 123');
    expect(chatLabel({ id: '456@g.us', is_group: true })).toBe('Grupo sin nombre · 456');
  });
});

