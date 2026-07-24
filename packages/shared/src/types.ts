import type { MessageClass, Priority } from './constants.js';

/** Normalised message extracted from a Baileys event, ready to persist. */
export interface NormalizedMessage {
  id: string;
  chatId: string;
  senderId: string | null;
  fromMe: boolean;
  messageType: string;
  textContent: string | null;
  quotedMessageId: string | null;
  mediaMimeType: string | null;
  mediaFileSize: number | null;
  isAudio: boolean;
  timestamp: Date;
  /** Full raw Baileys message JSON (stored as jsonb). */
  raw: unknown;
}

export interface ChatUpsert {
  id: string;
  isGroup: boolean;
  name?: string | null;
  subject?: string | null;
  type?: string;
  lastMessageAt?: Date | null;
}

export interface ContactUpsert {
  id: string;
  phone?: string | null;
  name?: string | null;
  pushName?: string | null;
  businessName?: string | null;
}

// ---------------------------------------------------------------------------
// Command parsing
// ---------------------------------------------------------------------------

export type CommandIntent =
  | 'status'
  | 'summary_today'
  | 'hot_leads'
  | 'pending'
  | 'unanswered'
  | 'search'
  | 'search_audios'
  | 'chat_lookup'
  | 'send_message'
  | 'send_group'
  | 'pause_listen'
  | 'resume_listen'
  | 'pause_send'
  | 'resume_send'
  | 'create_task'
  | 'agenda_today'
  | 'finance_add'
  | 'finance_summary'
  | 'currency_convert'
  | 'unknown';

export interface ParsedCommand {
  intent: CommandIntent;
  /** Short question to ask when an action is understood but one required field is missing. */
  clarification?: string;
  /** 'contact' | 'group' when the command targets someone. */
  targetType?: 'contact' | 'group';
  /** Free-text target (name / phone / group subject). */
  target?: string;
  /** Outbound message body for send intents. */
  message?: string;
  /** Free-text argument for search / chat lookup. */
  query?: string;
  /** Structured task fields for the daily assistant. */
  task?: {
    title: string;
    dueAt?: string | null;
    remindAt?: string | null;
    project?: string | null;
    priority?: Priority;
    recurrence?: 'daily' | 'weekly' | 'monthly' | null;
  };
  /** Multiple tasks when one explicit command contains a short list. */
  tasks?: {
    title: string;
    dueAt?: string | null;
    remindAt?: string | null;
    project?: string | null;
    priority?: Priority;
    recurrence?: 'daily' | 'weekly' | 'monthly' | null;
  }[];
  finance?: {
    kind: 'income' | 'expense' | 'debt';
    amount: number;
    currency?: 'ARS' | 'USD';
    components?: { amount: number; currency: 'ARS' | 'USD' }[];
    description: string;
    category?: string | null;
    dueAt?: string | null;
  };
  currency?: {
    amount: number;
    from: 'USD';
    to: 'ARS';
  };
  /** 0..1 confidence from the parser. */
  confidence: number;
  /** Raw command text, for logging. */
  raw: string;
}

// ---------------------------------------------------------------------------
// Contact resolution
// ---------------------------------------------------------------------------

export interface ContactCandidate {
  contactId: string;
  chatId: string;
  displayName: string;
  phone?: string;
  confidence: number;
}

export type ContactResolution =
  | {
      status: 'resolved';
      confidence: number;
      contactId: string;
      chatId: string;
      displayName: string;
    }
  | {
      status: 'ambiguous';
      candidates: ContactCandidate[];
    }
  | {
      status: 'not_found';
      reason: string;
    };

// ---------------------------------------------------------------------------
// AI structures
// ---------------------------------------------------------------------------

export interface MessageClassification {
  class: MessageClass;
  priority: Priority;
  isHotLead: boolean;
  reason?: string;
}

export interface DetectedTask {
  title: string;
  description?: string;
  priority: Priority;
  dueAt?: string | null;
}

export interface ChatSummary {
  summary: string;
  facts: Record<string, unknown>;
  pendingTasks: DetectedTask[];
}

export interface ContactProfile {
  commercialSummary: string;
  interests: string[];
  vehicles: string[];
  promises: string[];
  objections: string[];
  lastIntent: string | null;
  priorityScore: number;
}

// ---------------------------------------------------------------------------
// Memory context
// ---------------------------------------------------------------------------

export interface ContextMessage {
  id: string;
  fromMe: boolean;
  senderId: string | null;
  text: string;
  timestamp: string;
}

export interface BuiltContext {
  recentMessages: ContextMessage[];
  chatSummary: string;
  contactProfile: Partial<ContactProfile> | null;
  pendingTasks: DetectedTask[];
  relevantSemanticMessages: ContextMessage[];
  audioTranscripts: ContextMessage[];
}

// ---------------------------------------------------------------------------
// Actions / send pipeline
// ---------------------------------------------------------------------------

export interface SendRequest {
  targetType: 'contact' | 'group';
  target: string;
  message: string;
  requestedBy?: string | null;
  sourceChatId?: string | null;
  confidence?: number;
}

export type SendValidation =
  | { ok: true; chatId: string; contactId?: string; displayName: string; confidence: number }
  | { ok: false; reason: SendBlockReason; detail: string; candidates?: ContactCandidate[] };

export type SendBlockReason =
  | 'auto_send_disabled'
  | 'send_paused'
  | 'empty_message'
  | 'ambiguous_contact'
  | 'contact_not_found'
  | 'low_confidence'
  | 'group_requires_explicit_command'
  | 'global_rate_limit'
  | 'target_rate_limit'
  | 'target_cooldown'
  | 'duplicate_message';
