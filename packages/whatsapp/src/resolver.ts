import {
  findContactByExactJid,
  findContactCandidates,
  findGroupsByName,
  type ContactSearchRow,
} from '@wma/db';
import {
  type ContactResolution,
  type ContactCandidate,
  SEND_CONFIDENCE_THRESHOLD,
  USER_JID_SUFFIX,
} from '@wma/shared';
import { normalize } from '@wma/ai';

/**
 * Pure scoring used by the resolver. Exposed for unit testing without a DB.
 *
 * Scoring priority (spec §8):
 *   exact JID/phone > exact name > exact alias > partial name > recency.
 */
export function scoreCandidates(termRaw: string, rows: ContactSearchRow[]): ContactCandidate[] {
  const term = normalize(termRaw.trim());
  const termDigits = termRaw.replace(/\D/g, '');

  const scored = rows.map((r) => {
    const name = normalize(r.name ?? '');
    const push = normalize(r.pushName ?? '');
    const alias = normalize(r.alias ?? '');
    const display = normalize(r.displayName ?? '');
    const phone = (r.phone ?? '').replace(/\D/g, '');

    let score = 0;
    if (termDigits.length >= 6 && phone && phone.endsWith(termDigits)) score = Math.max(score, 0.97);
    if (name && name === term) score = Math.max(score, 0.96);
    if (alias && alias === term) score = Math.max(score, 0.95);
    if (push && push === term) score = Math.max(score, 0.9);
    if (name.startsWith(term) || display.startsWith(term)) score = Math.max(score, 0.88);
    if (name.includes(term) || push.includes(term) || alias.includes(term)) score = Math.max(score, 0.6);

    // Recency boost (small) — more recent contacts edge out stale ones.
    if (r.lastMessageAt) {
      const ageDays = (Date.now() - new Date(r.lastMessageAt).getTime()) / 86_400_000;
      if (ageDays < 7) score += 0.04;
      else if (ageDays < 30) score += 0.02;
    }

    return {
      contactId: r.contactId,
      chatId: r.chatId,
      displayName: r.displayName,
      phone: r.phone ?? undefined,
      confidence: Math.min(1, Number(score.toFixed(3))),
    } satisfies ContactCandidate;
  });

  // Deduplicate by contactId keeping the best score.
  const best = new Map<string, ContactCandidate>();
  for (const c of scored) {
    const prev = best.get(c.contactId);
    if (!prev || c.confidence > prev.confidence) best.set(c.contactId, c);
  }
  return [...best.values()].filter((c) => c.confidence > 0).sort((a, b) => b.confidence - a.confidence);
}

/** Decide resolution status from ranked candidates. */
export function decideResolution(candidates: ContactCandidate[]): ContactResolution {
  if (candidates.length === 0) {
    return { status: 'not_found', reason: 'No matching contact' };
  }
  const top = candidates[0]!;
  const second = candidates[1];

  // Ambiguous when the runner-up is close to the leader.
  if (second && top.confidence - second.confidence < 0.1 && second.confidence >= 0.55) {
    return { status: 'ambiguous', candidates: candidates.slice(0, 5) };
  }
  if (top.confidence >= SEND_CONFIDENCE_THRESHOLD) {
    return {
      status: 'resolved',
      confidence: top.confidence,
      contactId: top.contactId,
      chatId: top.chatId,
      displayName: top.displayName,
    };
  }
  // Single weak match — surface as ambiguous so the operator confirms.
  return { status: 'ambiguous', candidates: candidates.slice(0, 5) };
}

export class ContactResolver {
  /** Resolve a free-text contact reference to a single chat, or report ambiguity. */
  async resolveContact(termRaw: string): Promise<ContactResolution> {
    const term = termRaw.trim();
    if (!term) return { status: 'not_found', reason: 'Empty target' };

    // 1. Exact JID.
    if (term.includes('@')) {
      const row = await findContactByExactJid(term);
      if (row) {
        return { status: 'resolved', confidence: 1, contactId: row.contactId, chatId: row.chatId, displayName: row.displayName };
      }
    }

    // 2. Phone-only input → synthesize a JID and try exact.
    const digits = term.replace(/\D/g, '');
    if (digits.length >= 8 && digits === term.replace(/[\s+]/g, '')) {
      const jid = `${digits}${USER_JID_SUFFIX}`;
      const row = await findContactByExactJid(jid);
      if (row) {
        return { status: 'resolved', confidence: 0.99, contactId: row.contactId, chatId: row.chatId, displayName: row.displayName };
      }
    }

    // 3-7. Name / alias / partial / recency via scoring.
    const rows = await findContactCandidates(term);
    return decideResolution(scoreCandidates(term, rows));
  }

  /** Resolve a group by subject/name. Groups never resolve via the contact path. */
  async resolveGroup(termRaw: string): Promise<ContactResolution> {
    const term = termRaw.trim();
    if (!term) return { status: 'not_found', reason: 'Empty group target' };
    if (term.endsWith('@g.us')) {
      return { status: 'resolved', confidence: 1, contactId: term, chatId: term, displayName: term };
    }
    const groups = await findGroupsByName(term);
    const candidates: ContactCandidate[] = groups.map((g, i) => ({
      contactId: g.chatId,
      chatId: g.chatId,
      displayName: g.displayName,
      confidence: i === 0 ? 0.9 : 0.7,
    }));
    return decideResolution(candidates);
  }
}
