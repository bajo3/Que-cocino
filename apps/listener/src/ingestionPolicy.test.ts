import { describe, expect, it } from 'vitest';
import { shouldIngestMessage } from './ingestionPolicy.js';

describe('selective chat ingestion', () => {
  it('always allows the private control chat', () => {
    expect(shouldIngestMessage(true, false)).toBe(true);
  });

  it('allows an explicitly selected chat', () => {
    expect(shouldIngestMessage(false, true)).toBe(true);
  });

  it('rejects unselected chats and permission lookup failures', () => {
    expect(shouldIngestMessage(false, false)).toBe(false);
    expect(shouldIngestMessage(false, null)).toBe(false);
  });
});

