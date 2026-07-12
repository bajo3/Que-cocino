import { describe, expect, it } from 'vitest';
import type { NormalizedMessage } from '@wma/shared';
import {
  rememberControlEchoSendResult,
  rememberControlEchoText,
  shouldIgnoreControlEcho,
} from './controlEcho.js';

function message(overrides: Partial<NormalizedMessage>): NormalizedMessage {
  return {
    id: 'msg-1',
    chatId: 'me@s.whatsapp.net',
    senderId: 'me@s.whatsapp.net',
    fromMe: true,
    messageType: 'conversation',
    textContent: null,
    quotedMessageId: null,
    mediaMimeType: null,
    mediaFileSize: null,
    isAudio: false,
    timestamp: new Date('2026-07-07T12:00:00.000Z'),
    raw: {},
    ...overrides,
  };
}

describe('control echo filtering', () => {
  it('ignores a recently sent control reply by text once', () => {
    const text = [
      'Comando procesado.',
      'Ingreso registrado.',
    ].join('\n');

    rememberControlEchoText(text);

    expect(shouldIgnoreControlEcho(message({ id: 'reply-1', textContent: text }))).toBe(true);
    expect(shouldIgnoreControlEcho(message({ id: 'manual-1', textContent: text }))).toBe(false);
  });

  it('always ignores legacy unknown command replies', () => {
    const text = [
      'No pude interpretar ese comando.',
      'Podes probar con:',
      '- ingreso jesus diaz $950k + 50 usd',
    ].join('\n');

    expect(shouldIgnoreControlEcho(message({ id: 'legacy-1', textContent: text }))).toBe(true);
    expect(shouldIgnoreControlEcho(message({ id: 'legacy-2', textContent: text }))).toBe(true);
  });

  it('ignores a sent control reply by message id', () => {
    rememberControlEchoSendResult({ key: { id: 'reply-2' } });

    expect(shouldIgnoreControlEcho(message({ id: 'reply-2', textContent: 'anything' }))).toBe(true);
  });
});
