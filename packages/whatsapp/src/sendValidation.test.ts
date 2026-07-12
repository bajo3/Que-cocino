import { describe, it, expect } from 'vitest';
import { validateSend } from './sendValidation.js';
import type { ContactResolution } from '@wma/shared';

const resolved: ContactResolution = {
  status: 'resolved',
  confidence: 0.95,
  contactId: 'a@s.whatsapp.net',
  chatId: 'a@s.whatsapp.net',
  displayName: 'Juan Pérez',
};

const base = {
  message: 'hola',
  targetType: 'contact' as const,
  resolution: resolved,
  enableAutoSend: true,
  sendPaused: false,
  explicitGroupCommand: false,
};

describe('validateSend — anti-send rules', () => {
  it('allows a clean, confident contact send', () => {
    expect(validateSend(base).ok).toBe(true);
  });

  it('blocks when ENABLE_AUTO_SEND is false', () => {
    const r = validateSend({ ...base, enableAutoSend: false });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toBe('auto_send_disabled');
  });

  it('blocks when sending is paused', () => {
    const r = validateSend({ ...base, sendPaused: true });
    expect(r.ok === false && r.reason).toBe('send_paused');
  });

  it('blocks empty messages', () => {
    const r = validateSend({ ...base, message: '   ' });
    expect(r.ok === false && r.reason).toBe('empty_message');
  });

  it('blocks ambiguous contacts (more than one match)', () => {
    const r = validateSend({
      ...base,
      resolution: {
        status: 'ambiguous',
        candidates: [
          { contactId: 'a', chatId: 'a', displayName: 'Juan Pérez', confidence: 0.6 },
          { contactId: 'b', chatId: 'b', displayName: 'Juan Taller', confidence: 0.58 },
        ],
      },
    });
    expect(r.ok === false && r.reason).toBe('ambiguous_contact');
  });

  it('blocks not-found contacts', () => {
    const r = validateSend({ ...base, resolution: { status: 'not_found', reason: 'x' } });
    expect(r.ok === false && r.reason).toBe('contact_not_found');
  });

  it('blocks low-confidence resolved contacts', () => {
    const r = validateSend({ ...base, resolution: { ...resolved, confidence: 0.5 } });
    expect(r.ok === false && r.reason).toBe('low_confidence');
  });

  it('blocks group sends without the explicit group command', () => {
    const r = validateSend({ ...base, targetType: 'group', explicitGroupCommand: false });
    expect(r.ok === false && r.reason).toBe('group_requires_explicit_command');
  });

  it('allows group sends with the explicit group command', () => {
    const r = validateSend({
      ...base,
      targetType: 'group',
      explicitGroupCommand: true,
      resolution: { ...resolved, chatId: 'g@g.us', contactId: 'g@g.us' },
    });
    expect(r.ok).toBe(true);
  });
});
