import type { SendBlockReason, SendValidation } from '@wma/shared';

export interface OutboundSafetyPolicy {
  maxPerHour: number;
  maxPerChatPerHour: number;
  chatCooldownMs: number;
  duplicateWindowMs: number;
  minDispatchDelayMs: number;
  delayPerCharMs: number;
  maxDispatchDelayMs: number;
}

export interface OutboundSafetySnapshot {
  sentGloballyInWindow: number;
  sentToTargetInWindow: number;
  lastSentToTargetAt: Date | null;
  duplicateSentAt: Date | null;
}

export interface OutboundSafetyParams {
  policy: OutboundSafetyPolicy;
  snapshot: OutboundSafetySnapshot;
  now?: Date;
}

export function validateOutboundSafety(params: OutboundSafetyParams): SendValidation {
  const { policy, snapshot } = params;
  const now = params.now ?? new Date();

  if (snapshot.sentGloballyInWindow >= policy.maxPerHour) {
    return block('global_rate_limit', `Outbound hourly limit reached (${policy.maxPerHour}/hour)`);
  }

  if (snapshot.sentToTargetInWindow >= policy.maxPerChatPerHour) {
    return block('target_rate_limit', `Per-chat hourly limit reached (${policy.maxPerChatPerHour}/hour)`);
  }

  if (snapshot.lastSentToTargetAt && policy.chatCooldownMs > 0) {
    const elapsed = now.getTime() - snapshot.lastSentToTargetAt.getTime();
    if (elapsed >= 0 && elapsed < policy.chatCooldownMs) {
      return block('target_cooldown', `Last outbound message to this chat was ${Math.ceil(elapsed / 1000)}s ago`);
    }
  }

  if (snapshot.duplicateSentAt && policy.duplicateWindowMs > 0) {
    return block('duplicate_message', 'Same message was already sent to this chat recently');
  }

  return {
    ok: true,
    chatId: '',
    displayName: '',
    confidence: 1,
  };
}

export function computeDispatchDelayMs(text: string, policy: OutboundSafetyPolicy): number {
  const computed = policy.minDispatchDelayMs + text.trim().length * policy.delayPerCharMs;
  return Math.min(policy.maxDispatchDelayMs, Math.max(policy.minDispatchDelayMs, computed));
}

function block(reason: SendBlockReason, detail: string): SendValidation {
  return { ok: false, reason, detail };
}
