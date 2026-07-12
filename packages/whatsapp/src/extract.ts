import type { NormalizedMessage } from '@wma/shared';
import { isGroupJid, USER_JID_SUFFIX } from '@wma/shared';

/**
 * Loosely-typed view of a Baileys proto.IWebMessageInfo. We keep this minimal
 * and defensive rather than depending on Baileys' generated protobuf types,
 * which makes extraction resilient to message variants.
 */
interface WAKey {
  remoteJid?: string | null;
  fromMe?: boolean | null;
  id?: string | null;
  participant?: string | null;
}
interface WAMessageInfo {
  key?: WAKey;
  message?: Record<string, any> | null;
  messageTimestamp?: number | Long | null;
  pushName?: string | null;
}
interface Long {
  toNumber(): number;
}

const TEXT_TYPES = ['conversation', 'extendedTextMessage'] as const;

function tsToDate(ts?: number | Long | null): Date {
  if (ts == null) return new Date();
  const n = typeof ts === 'number' ? ts : ts.toNumber();
  return new Date(n * 1000);
}

/** Detect the dominant content type key inside a Baileys message. */
export function messageContentType(message: Record<string, any> | null | undefined): string {
  if (!message) return 'unknown';
  const keys = Object.keys(message).filter(
    (k) => !['senderKeyDistributionMessage', 'messageContextInfo'].includes(k),
  );
  return keys[0] ?? 'unknown';
}

export function extractText(message: Record<string, any> | null | undefined): string | null {
  if (!message) return null;
  if (typeof message.conversation === 'string') return message.conversation;
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
  if (message.imageMessage?.caption) return message.imageMessage.caption;
  if (message.videoMessage?.caption) return message.videoMessage.caption;
  if (message.documentMessage?.caption) return message.documentMessage.caption;
  if (message.buttonsResponseMessage?.selectedDisplayText) return message.buttonsResponseMessage.selectedDisplayText;
  if (message.listResponseMessage?.title) return message.listResponseMessage.title;
  return null;
}

/** True if this message carries a voice note / audio. */
export function isAudioMessage(message: Record<string, any> | null | undefined): boolean {
  return !!message?.audioMessage;
}

export function unwrap(message: Record<string, any> | null | undefined): Record<string, any> | null {
  // Unwrap ephemeral / viewOnce / deviceSent wrappers.
  if (!message) return null;
  if (message.ephemeralMessage?.message) return unwrap(message.ephemeralMessage.message);
  if (message.viewOnceMessage?.message) return unwrap(message.viewOnceMessage.message);
  if (message.viewOnceMessageV2?.message) return unwrap(message.viewOnceMessageV2.message);
  if (message.documentWithCaptionMessage?.message) return unwrap(message.documentWithCaptionMessage.message);
  return message;
}

/** Normalize a raw Baileys message into our persistence shape. */
export function normalizeMessage(info: WAMessageInfo, ownerJid?: string | null): NormalizedMessage | null {
  const key = info.key;
  if (!key?.id || !key.remoteJid) return null;

  const chatId = key.remoteJid;
  const fromMe = !!key.fromMe;
  const message = unwrap(info.message);
  const type = messageContentType(message);
  const text = extractText(message);
  const audio = isAudioMessage(message);

  let senderId: string | null;
  if (fromMe) senderId = ownerJid ?? null;
  else if (isGroupJid(chatId)) senderId = key.participant ?? null;
  else senderId = chatId;

  const content = message ?? {};
  const mediaNode =
    content.audioMessage ??
    content.imageMessage ??
    content.videoMessage ??
    content.documentMessage ??
    content.stickerMessage ??
    null;

  const ctxStanza =
    content.extendedTextMessage?.contextInfo?.stanzaId ??
    mediaNode?.contextInfo?.stanzaId ??
    null;

  return {
    id: key.id,
    chatId,
    senderId,
    fromMe,
    messageType: type,
    textContent: text,
    quotedMessageId: ctxStanza,
    mediaMimeType: mediaNode?.mimetype ?? null,
    mediaFileSize: mediaNode?.fileLength ? Number(mediaNode.fileLength) : null,
    isAudio: audio,
    timestamp: tsToDate(info.messageTimestamp),
    raw: info,
  };
}

/** Extract a phone number from a user JID (549XXXX@s.whatsapp.net -> 549XXXX). */
export function phoneFromJid(jid: string | null | undefined): string | null {
  if (!jid) return null;
  if (!jid.endsWith(USER_JID_SUFFIX)) return null;
  const num = jid.split('@')[0]?.split(':')[0];
  return num ?? null;
}

export function audioDurationSeconds(message: Record<string, any> | null | undefined): number | null {
  const s = unwrap(message)?.audioMessage?.seconds;
  return typeof s === 'number' ? s : null;
}
