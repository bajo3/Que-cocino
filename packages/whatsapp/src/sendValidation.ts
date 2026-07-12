import {
  type SendValidation,
  type ContactResolution,
  SEND_CONFIDENCE_THRESHOLD,
} from '@wma/shared';

export interface ValidateSendParams {
  message: string;
  targetType: 'contact' | 'group';
  resolution: ContactResolution;
  enableAutoSend: boolean;
  sendPaused: boolean;
  /** True only when sending to a group was explicitly requested (/mandar-grupo). */
  explicitGroupCommand: boolean;
}

/**
 * Pure anti-send validation. Implements spec §6 rules 4-9. No side effects so
 * it can be unit-tested exhaustively. The MessageSender calls this and only
 * touches Baileys when it returns { ok: true }.
 */
export function validateSend(p: ValidateSendParams): SendValidation {
  // Rule 4: master switch.
  if (!p.enableAutoSend) {
    return { ok: false, reason: 'auto_send_disabled', detail: 'ENABLE_AUTO_SEND is false' };
  }
  // Rule 5: runtime pause.
  if (p.sendPaused) {
    return { ok: false, reason: 'send_paused', detail: 'Sending is paused (send_paused=true)' };
  }
  // Rule 8: no empty messages.
  if (!p.message || !p.message.trim()) {
    return { ok: false, reason: 'empty_message', detail: 'Refusing to send an empty message' };
  }
  // Rule 9: groups require the explicit /mandar-grupo command.
  if (p.targetType === 'group' && !p.explicitGroupCommand) {
    return {
      ok: false,
      reason: 'group_requires_explicit_command',
      detail: 'Use /mandar-grupo to message a group',
    };
  }
  // Rules 6 & 7: contact resolution must be unambiguous and confident.
  switch (p.resolution.status) {
    case 'not_found':
      return { ok: false, reason: 'contact_not_found', detail: p.resolution.reason };
    case 'ambiguous':
      return {
        ok: false,
        reason: 'ambiguous_contact',
        detail: 'Multiple possible targets — clarification required',
        candidates: p.resolution.candidates,
      };
    case 'resolved':
      if (p.resolution.confidence < SEND_CONFIDENCE_THRESHOLD) {
        return { ok: false, reason: 'low_confidence', detail: `Confidence ${p.resolution.confidence} below threshold` };
      }
      return {
        ok: true,
        chatId: p.resolution.chatId,
        contactId: p.resolution.contactId,
        displayName: p.resolution.displayName,
        confidence: p.resolution.confidence,
      };
  }
}

/** Human-readable clarification prompt for ambiguous matches (spec §9). */
export function formatAmbiguityPrompt(termRaw: string, candidates: { displayName: string; phone?: string }[]): string {
  const lines = candidates
    .slice(0, 5)
    .map((c, i) => `${i + 1}. ${c.displayName}${c.phone ? ` - ${c.phone}` : ''}`)
    .join('\n');
  return `Encontré varios contactos para "${termRaw}":\n\n${lines}\n\nRespondé con:\n${candidates
    .slice(0, 5)
    .map((_, i) => `${i + 1}`)
    .join('\n')}`;
}
