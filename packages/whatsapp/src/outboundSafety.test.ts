import { describe, expect, it } from 'vitest';
import { computeDispatchDelayMs, validateOutboundSafety, type OutboundSafetyPolicy } from './outboundSafety.js';

const policy: OutboundSafetyPolicy = {
  maxPerHour: 20,
  maxPerChatPerHour: 4,
  chatCooldownMs: 45_000,
  duplicateWindowMs: 24 * 60 * 60 * 1000,
  minDispatchDelayMs: 1_500,
  delayPerCharMs: 15,
  maxDispatchDelayMs: 12_000,
};

const cleanSnapshot = {
  sentGloballyInWindow: 3,
  sentToTargetInWindow: 1,
  lastSentToTargetAt: new Date('2026-07-08T12:00:00.000Z'),
  duplicateSentAt: null,
};

describe('outbound safety policy', () => {
  it('allows sends below limits and outside cooldown', () => {
    const result = validateOutboundSafety({
      policy,
      snapshot: cleanSnapshot,
      now: new Date('2026-07-08T12:01:00.000Z'),
    });

    expect(result.ok).toBe(true);
  });

  it('blocks when the global hourly cap is reached', () => {
    const result = validateOutboundSafety({
      policy,
      snapshot: { ...cleanSnapshot, sentGloballyInWindow: 20 },
      now: new Date('2026-07-08T12:01:00.000Z'),
    });

    expect(result.ok === false && result.reason).toBe('global_rate_limit');
  });

  it('blocks when the per-chat hourly cap is reached', () => {
    const result = validateOutboundSafety({
      policy,
      snapshot: { ...cleanSnapshot, sentToTargetInWindow: 4 },
      now: new Date('2026-07-08T12:01:00.000Z'),
    });

    expect(result.ok === false && result.reason).toBe('target_rate_limit');
  });

  it('blocks when the target chat is still cooling down', () => {
    const result = validateOutboundSafety({
      policy,
      snapshot: cleanSnapshot,
      now: new Date('2026-07-08T12:00:20.000Z'),
    });

    expect(result.ok === false && result.reason).toBe('target_cooldown');
  });

  it('blocks repeated messages in the duplicate window', () => {
    const result = validateOutboundSafety({
      policy,
      snapshot: { ...cleanSnapshot, duplicateSentAt: new Date('2026-07-08T11:00:00.000Z') },
      now: new Date('2026-07-08T12:01:00.000Z'),
    });

    expect(result.ok === false && result.reason).toBe('duplicate_message');
  });

  it('computes a bounded dispatch delay', () => {
    expect(computeDispatchDelayMs('hola', policy)).toBe(1560);
    expect(computeDispatchDelayMs('x'.repeat(2_000), policy)).toBe(12_000);
  });
});
