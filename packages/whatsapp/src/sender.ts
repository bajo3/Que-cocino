import { createHash } from 'node:crypto';
import { loadEnv, logger, type SendRequest } from '@wma/shared';
import { isSendPaused, insertAction, outboundSafetySnapshot, updateAction } from '@wma/db';
import { ContactResolver } from './resolver.js';
import { validateSend, formatAmbiguityPrompt } from './sendValidation.js';
import {
  computeDispatchDelayMs,
  validateOutboundSafety,
  type OutboundSafetyPolicy,
  type OutboundSafetySnapshot,
} from './outboundSafety.js';

/** Minimal surface of a Baileys socket we depend on (keeps this testable). */
export interface WASocketLike {
  sendMessage(jid: string, content: { text: string }): Promise<unknown>;
}

export interface SendOutcome {
  status: 'sent' | 'blocked' | 'needs_confirmation';
  actionId: string;
  /** Message to echo back into the control chat (clarifications, confirmations). */
  reply?: string;
  reason?: string;
}

/**
 * MessageSender is the ONLY path that puts messages on the wire. Every attempt
 * (allowed or blocked) is recorded in wa_actions.
 */
export class MessageSender {
  private readonly resolver = new ContactResolver();

  constructor(private readonly socket: WASocketLike) {}

  async send(req: SendRequest): Promise<SendOutcome> {
    const env = loadEnv();
    const isGroup = req.targetType === 'group';
    const messageHash = hashMessage(req.message);
    const policy = outboundSafetyPolicyFromEnv(env);

    const resolution = isGroup
      ? await this.resolver.resolveGroup(req.target)
      : await this.resolver.resolveContact(req.target);

    const sendPaused = await safeIsSendPaused();

    const validation = validateSend({
      message: req.message,
      targetType: req.targetType,
      resolution,
      enableAutoSend: env.ENABLE_AUTO_SEND,
      sendPaused,
      explicitGroupCommand: isGroup, // only reached here via /mandar-grupo or NL group intent
    });

    const safety =
      validation.ok
        ? validateOutboundSafety({
            policy,
            snapshot: await safeOutboundSafetySnapshot(validation.chatId, messageHash, policy),
          })
        : null;
    const blockedSafety = safety && !safety.ok ? safety : null;

    // Record the action attempt regardless of outcome.
    const actionId = await insertAction({
      actionType: isGroup ? 'send_group' : 'send_message',
      requestedBy: req.requestedBy ?? null,
      sourceChatId: req.sourceChatId ?? null,
      targetChatId: validation.ok ? validation.chatId : null,
      targetContactId: validation.ok ? validation.contactId ?? null : null,
      payload: { target: req.target, length: req.message.length, messageHash },
      status: validation.ok && !blockedSafety ? 'validated' : 'blocked',
      confidence: validation.ok ? validation.confidence : req.confidence ?? null,
    });

    if (!validation.ok || blockedSafety) {
      const block = validation.ok ? blockedSafety! : validation;
      const reply =
        block.reason === 'ambiguous_contact' && block.candidates
          ? formatAmbiguityPrompt(req.target, block.candidates)
          : `No envie el mensaje: ${block.detail}`;
      logger.warn({ actionId, reason: block.reason }, 'send blocked');
      await updateAction(actionId, { status: 'blocked', error: block.reason });
      return { status: 'blocked', actionId, reply, reason: block.reason };
    }

    // Optional human confirmation gate. The control-chat handler is responsible
    // for resuming a pending action; here we just stop short.
    if (env.CONFIRM_BEFORE_SEND) {
      await updateAction(actionId, { status: 'awaiting_confirmation' });
      return {
        status: 'needs_confirmation',
        actionId,
        reply: `Confirmas enviar a ${validation.displayName}? Responde "si ${actionId.slice(0, 8)}" para confirmar.`,
      };
    }

    return this.dispatch(
      actionId,
      validation.chatId,
      req.message,
      validation.displayName,
      computeDispatchDelayMs(req.message, policy),
    );
  }

  /** Actually put the message on the wire and finalize the action row. */
  async dispatch(actionId: string, chatId: string, text: string, displayName: string, delayMs = 0): Promise<SendOutcome> {
    try {
      if (delayMs > 0) await sleep(delayMs);
      await this.socket.sendMessage(chatId, { text });
      await updateAction(actionId, { status: 'sent', executedAt: new Date() });
      logger.info({ actionId, chatId }, 'message sent');
      return { status: 'sent', actionId, reply: `Enviado a ${displayName}.` };
    } catch (err) {
      const msg = (err as Error).message;
      await updateAction(actionId, { status: 'error', error: msg });
      logger.error({ actionId, err: msg }, 'send failed');
      return { status: 'blocked', actionId, reply: `Error al enviar: ${msg}`, reason: 'send_error' };
    }
  }
}

function outboundSafetyPolicyFromEnv(env: ReturnType<typeof loadEnv>): OutboundSafetyPolicy {
  return {
    maxPerHour: env.SEND_MAX_PER_HOUR,
    maxPerChatPerHour: env.SEND_MAX_PER_CHAT_PER_HOUR,
    chatCooldownMs: env.SEND_CHAT_COOLDOWN_MS,
    duplicateWindowMs: env.SEND_DUPLICATE_WINDOW_MS,
    minDispatchDelayMs: env.SEND_MIN_DISPATCH_DELAY_MS,
    delayPerCharMs: env.SEND_DELAY_PER_CHAR_MS,
    maxDispatchDelayMs: env.SEND_MAX_DISPATCH_DELAY_MS,
  };
}

async function safeOutboundSafetySnapshot(
  targetChatId: string,
  messageHash: string,
  policy: OutboundSafetyPolicy,
): Promise<OutboundSafetySnapshot> {
  const now = new Date();
  try {
    return await outboundSafetySnapshot({
      targetChatId,
      messageHash,
      since: new Date(now.getTime() - 60 * 60 * 1000),
      duplicateSince: new Date(now.getTime() - policy.duplicateWindowMs),
    });
  } catch (error) {
    logger.warn({ targetChatId, err: (error as Error).message }, 'outbound safety snapshot unavailable');
    return {
      sentGloballyInWindow: policy.maxPerHour,
      sentToTargetInWindow: policy.maxPerChatPerHour,
      lastSentToTargetAt: now,
      duplicateSentAt: now,
    };
  }
}

function hashMessage(message: string): string {
  return createHash('sha256').update(message.trim().replace(/\s+/g, ' ').toLowerCase()).digest('hex');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeIsSendPaused(): Promise<boolean> {
  try {
    return await isSendPaused();
  } catch {
    // If settings can't be read, fail safe and treat sending as paused.
    return true;
  }
}
