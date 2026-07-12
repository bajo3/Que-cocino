import type { WASocket } from '@whiskeysockets/baileys';
import {
  normalizeMessage,
  phoneFromJid,
  AudioProcessor,
} from '@wma/whatsapp';
import {
  ensureAccount,
  upsertChat,
  upsertContact,
  upsertGroupParticipant,
  insertMessage,
  createAudioTranscript,
  setAudioUrl,
  setMessageMediaUrl,
  uploadMedia,
  isListenPaused,
  isChatReadEnabled,
  linkContactIdentity,
  listLidChatIds,
} from '@wma/db';
import { loadEnv, logger, safeMessageLog, isGroupJid, type NormalizedMessage } from '@wma/shared';
import { enqueue, QUEUE_NAMES } from './queue.js';
import { handleControlCommand, looksLikeControlCommand } from './control.js';
import { shouldIngestMessage } from './ingestionPolicy.js';
import {
  rememberControlEchoSendResult,
  rememberControlEchoText,
  shouldIgnoreControlEcho,
} from './controlEcho.js';

let accountId: string | null = null;
let ownerJid: string | null = null;
let ownerLid: string | null = null;

function bareJid(jid: string | null | undefined): string | null {
  if (!jid) return null;
  const [user] = jid.split('@');
  const domain = jid.split('@')[1];
  return user ? `${user.split(':')[0]}@${domain}` : null;
}

function ownerPhoneJid(phone: string | null | undefined): string | null {
  const digits = phone?.replace(/\D/g, '');
  return digits ? `${digits}@s.whatsapp.net` : null;
}

export function bindHandlers(sock: WASocket): void {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const info of messages) {
      try {
        await handleMessage(sock, info);
      } catch (err) {
        logger.error({ err: (err as Error).message }, 'message handler error');
      }
    }
  });

  sock.ev.on('contacts.upsert', async (contacts) => {
    for (const c of contacts) await safeUpsertContact(c);
  });
  sock.ev.on('contacts.update', async (contacts) => {
    for (const c of contacts) await safeUpsertContact(c);
  });

  sock.ev.on('lid-mapping.update', async ({ lid, pn }) => {
    await safeLinkContactIdentity(lid, pn);
  });

  sock.ev.on('messaging-history.set', async ({ chats, contacts, lidPnMappings }) => {
    for (const c of contacts) await safeUpsertContact(c);
    for (const c of chats) await safeUpsertChat(c);
    for (const mapping of lidPnMappings ?? []) {
      await safeLinkContactIdentity(mapping.lid, mapping.pn);
    }
  });

  sock.ev.on('chats.upsert', async (chats) => {
    for (const c of chats) await safeUpsertChat(c);
  });
  sock.ev.on('chats.update', async (chats) => {
    for (const c of chats) await safeUpsertChat(c);
  });

  sock.ev.on('groups.update', async (updates) => {
    for (const g of updates) {
      if (!g.id) continue;
      await upsertChat({ id: g.id, isGroup: true, subject: g.subject ?? null, name: g.subject ?? null }, accountId).catch(
        () => {},
      );
    }
  });

  sock.ev.on('group-participants.update', async (ev) => {
    try {
      await upsertChat({ id: ev.id, isGroup: true }, accountId);
      for (const p of ev.participants) {
        // Baileys 7 may deliver participants as objects ({ id }) or as plain JIDs.
        const jid = typeof p === 'string' ? p : (p as { id: string }).id;
        if (!jid) continue;
        await upsertContact({ id: jid, phone: phoneFromJid(jid) }, accountId);
        await upsertGroupParticipant(ev.id, jid, ev.action === 'promote' ? 'admin' : undefined);
      }
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'participants update failed');
    }
  });
}

export async function onReady(sock: WASocket): Promise<void> {
  ownerJid = sock.user?.id ?? null;
  ownerLid = (sock.user as { lid?: string } | undefined)?.lid ?? null;
  logger.info({ ownerJid, ownerLid }, 'owner identity');
  const bare = bareJid(ownerJid);
  try {
    accountId = await ensureAccount(bare ?? ownerJid ?? 'unknown', phoneFromJid(bare) ?? undefined, sock.user?.name ?? undefined);
    logger.info({ accountId }, 'account ensured');
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'could not ensure account (DB down?)');
    return;
  }

  // WhatsApp may initially expose opaque LIDs and bare group JIDs. Resolve
  // persisted mappings and fetch current group subjects on every start.
  await syncKnownIdentities(sock).catch((err) =>
    logger.warn({ err: (err as Error).message }, 'stored identity synchronization failed'),
  );
  await syncParticipatingGroups(sock);
}

async function handleMessage(sock: WASocket, info: any): Promise<void> {
  const env = loadEnv();
  const norm = normalizeMessage(info, bareJid(ownerJid));
  if (!norm) return;
  if (norm.chatId === 'status@broadcast') return; // ignore status updates

  // A message is a control command if it's from me AND lands in my own
  // self-chat. The self-chat may be addressed by the configured JID, by my
  // phone JID, or by my LID (WhatsApp's newer identifier) — accept any.
  const chatBare = bareJid(norm.chatId);
  const controlJids = new Set(
    [
      bareJid(env.CONTROL_CHAT_JID),
      bareJid(ownerPhoneJid(env.OWNER_PHONE)),
      bareJid(ownerJid),
      bareJid(ownerLid),
    ].filter((jid): jid is string => !!jid),
  );
  const textContent = norm.textContent ?? '';
  const botPrefixed = hasBotPrefix(textContent);
  const commandText = botPrefixed ? stripBotPrefix(textContent) : textContent;
  const ownerAuthored = norm.fromMe || (!!chatBare && controlJids.has(chatBare));
  const explicitOwnerCommand = ownerAuthored && !!norm.textContent && (looksLikeControlCommand(norm.textContent) || botPrefixed);
  const isControl = (!!chatBare && controlJids.has(chatBare)) || explicitOwnerCommand;

  // Respect "pausar escucha" for everything except control commands.
  if (!isControl) {
    let paused = false;
    try {
      paused = await isListenPaused();
    } catch {
      paused = false;
    }
    if (paused) return;
  }

  if (isControl && shouldIgnoreControlEcho(norm)) {
    logger.debug({ messageId: norm.id }, 'control echo ignored');
    return;
  }

  // Keep enough metadata to let the operator discover and select chats, but do
  // not persist message content until reading is explicitly enabled.
  await ensureChatAndContact(norm, info);

  if (!isControl) {
    let readEnabled: boolean | null = null;
    try {
      readEnabled = await isChatReadEnabled(norm.chatId);
    } catch (err) {
      // Privacy-safe default: if permission cannot be checked, do not ingest.
      logger.warn(
        { chatId: norm.chatId, err: (err as Error).message },
        'could not check chat reading permission; message skipped',
      );
    }
    if (!shouldIngestMessage(isControl, readEnabled)) {
      logger.debug({ chatId: norm.chatId, messageId: norm.id }, 'message skipped; chat reading disabled');
      return;
    }
  }

  // 1) Persist first (stability rule: save before processing).
  const inserted = await insertMessage(norm, accountId);
  logger.info(safeMessageLog(norm), inserted ? 'message saved' : 'message duplicate');

  if (!inserted) return; // already processed previously

  // 2) Control commands from the owner/control chat.
  if (isControl && norm.textContent) {
    const allowConversation = (!!chatBare && controlJids.has(chatBare)) || botPrefixed;
    const reply = await handleControlCommand(sock, commandText, norm.id, norm.chatId, { allowConversation });
    if (reply) {
      rememberControlEchoText(reply);
      await sock
        .sendMessage(norm.chatId, { text: reply })
        .then(rememberControlEchoSendResult)
        .catch((e) => logger.error({ err: (e as Error).message }, 'failed to reply to control chat'));
    }
    return; // do not enqueue commands for AI processing
  }

  // 3) Audio handling.
  if (norm.isAudio && env.ENABLE_AUDIO_DOWNLOAD) {
    await handleAudio(sock, norm, info).catch((e) =>
      logger.error({ messageId: norm.id, err: (e as Error).message }, 'audio handling failed'),
    );
  }

  // 4) Enqueue for AI processing when there is text content.
  if (norm.textContent?.trim()) {
    await enqueue(QUEUE_NAMES.processMessage, { messageId: norm.id, chatId: norm.chatId });
  }
}

async function handleAudio(sock: WASocket, norm: NormalizedMessage, info: any): Promise<void> {
  const transcriptId = await createAudioTranscript({
    messageId: norm.id,
    chatId: norm.chatId,
    senderId: norm.senderId,
    fromMe: norm.fromMe,
  });

  const processor = new AudioProcessor(sock as any);
  const audio = await processor.download(info);
  const { path, publicUrl } = await uploadMedia({
    folder: 'whatsapp-audio',
    chatId: norm.chatId,
    messageId: norm.id,
    ext: audio.ext,
    contentType: audio.mime,
    data: audio.buffer,
  });
  await setAudioUrl(transcriptId, publicUrl ?? path);
  await setMessageMediaUrl(norm.id, publicUrl ?? path);

  await enqueue(QUEUE_NAMES.transcribeAudio, {
    transcriptId,
    storagePath: path,
    mime: audio.mime,
    messageId: norm.id,
    chatId: norm.chatId,
    fromMe: norm.fromMe,
  });
}

async function ensureChatAndContact(norm: NormalizedMessage, info: any): Promise<void> {
  const group = isGroupJid(norm.chatId);
  await upsertChat(
    {
      id: norm.chatId,
      isGroup: group,
      lastMessageAt: norm.timestamp,
      name: !group ? info?.pushName ?? null : null,
    },
    accountId,
  );

  if (group) {
    if (norm.senderId) {
      await upsertContact({ id: norm.senderId, phone: phoneFromJid(norm.senderId), pushName: info?.pushName ?? null }, accountId);
      await upsertGroupParticipant(norm.chatId, norm.senderId);
    }
  } else if (!norm.fromMe) {
    await upsertContact(
      { id: norm.chatId, phone: phoneFromJid(norm.chatId), pushName: info?.pushName ?? null },
      accountId,
    );
  }
}

async function safeUpsertContact(c: any): Promise<void> {
  if (!c?.id) return;
  try {
    const phoneJid = normalizePhoneJid(c.phoneNumber) ?? (c.id.endsWith('@s.whatsapp.net') ? bareJid(c.id) : null);
    const lid = c.lid ?? (c.id.endsWith('@lid') ? bareJid(c.id) : null);
    const ids = new Set<string>([bareJid(c.id), bareJid(lid)].filter((id): id is string => !!id));

    for (const id of ids) {
      await upsertContact(
        {
          id,
          phone: phoneFromJid(phoneJid),
          name: c.name ?? null,
          pushName: c.notify ?? null,
          businessName: c.verifiedName ?? null,
        },
        accountId,
      );
    }

    if (lid && phoneJid) await linkContactIdentity(lid, phoneJid, accountId);
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'contact upsert failed');
  }
}

async function safeUpsertChat(c: any): Promise<void> {
  if (!c?.id) return;
  try {
    await upsertChat({ id: c.id, isGroup: isGroupJid(c.id), name: c.name ?? null, subject: c.subject ?? null }, accountId);
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'chat upsert failed');
  }
}

async function safeLinkContactIdentity(lidRaw: string, phoneRaw: string): Promise<void> {
  const lid = bareJid(lidRaw);
  const phoneJid = normalizePhoneJid(phoneRaw);
  if (!lid || !lid.endsWith('@lid') || !phoneJid) return;
  try {
    await linkContactIdentity(lid, phoneJid, accountId);
  } catch (err) {
    logger.warn({ lid, err: (err as Error).message }, 'LID/phone identity link failed');
  }
}

async function syncKnownIdentities(sock: WASocket): Promise<void> {
  const lids = await listLidChatIds();
  let linked = 0;
  for (const lid of lids) {
    try {
      const phoneJid = await sock.signalRepository.lidMapping.getPNForLID(lid);
      if (!phoneJid) continue;
      await linkContactIdentity(lid, phoneJid, accountId);
      linked++;
    } catch (err) {
      logger.debug({ lid, err: (err as Error).message }, 'could not resolve stored LID');
    }
  }
  logger.info({ checked: lids.length, linked }, 'stored LID identities synchronized');
}

async function syncParticipatingGroups(sock: WASocket): Promise<void> {
  try {
    const groups = await sock.groupFetchAllParticipating();
    for (const group of Object.values(groups)) {
      await upsertChat(
        {
          id: group.id,
          isGroup: true,
          name: group.subject,
          subject: group.subject,
        },
        accountId,
      );
      for (const participant of group.participants ?? []) {
        await safeUpsertContact(participant);
        const participantId = bareJid(participant.id);
        if (!participantId) continue;
        await upsertGroupParticipant(
          group.id,
          participantId,
          participant.admin ?? (participant.isAdmin ? 'admin' : undefined),
        );
      }
    }
    logger.info({ groups: Object.keys(groups).length }, 'group names synchronized');
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'group metadata synchronization failed');
  }
}

function normalizePhoneJid(value: string | null | undefined): string | null {
  if (!value) return null;
  const bare = bareJid(value.includes('@') ? value : `${value}@s.whatsapp.net`);
  return bare?.endsWith('@s.whatsapp.net') ? bare : null;
}

function stripBotPrefix(text: string): string {
  return text.replace(/^\s*bot[\s,:-]+/i, '').trim();
}

function hasBotPrefix(text: string): boolean {
  return /^\s*bot[\s,:-]+/i.test(text);
}
