import type { NormalizedMessage } from '@wma/shared';

const ECHO_TTL_MS = 5 * 60 * 1000;

const echoMessageIds = new Map<string, number>();
const echoTexts = new Map<string, { expiresAt: number; count: number }>();

export function rememberControlEchoText(text: string): void {
  const key = normalizeEchoText(text);
  if (!key) return;
  cleanupEchoes();
  const current = echoTexts.get(key);
  echoTexts.set(key, {
    expiresAt: Date.now() + ECHO_TTL_MS,
    count: (current?.count ?? 0) + 1,
  });
}

export function rememberControlEchoSendResult(result: unknown): void {
  const id = (result as { key?: { id?: string | null } } | null)?.key?.id;
  if (!id) return;
  cleanupEchoes();
  echoMessageIds.set(id, Date.now() + ECHO_TTL_MS);
}

export function shouldIgnoreControlEcho(message: NormalizedMessage): boolean {
  cleanupEchoes();

  if (echoMessageIds.delete(message.id)) return true;

  const key = normalizeEchoText(message.textContent);
  if (!key) return false;
  if (isLegacyUnknownCommandReply(key)) return true;

  const current = echoTexts.get(key);
  if (!current) return false;
  if (current.count <= 1) echoTexts.delete(key);
  else echoTexts.set(key, { ...current, count: current.count - 1 });
  return true;
}

function normalizeEchoText(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

function isLegacyUnknownCommandReply(text: string): boolean {
  return /^No pude interpretar ese comando\./i.test(text);
}

function cleanupEchoes(now = Date.now()): void {
  for (const [id, expiresAt] of echoMessageIds) {
    if (expiresAt <= now) echoMessageIds.delete(id);
  }
  for (const [text, entry] of echoTexts) {
    if (entry.expiresAt <= now) echoTexts.delete(text);
  }
}
