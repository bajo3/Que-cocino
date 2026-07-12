export const QUEUE_NAMES = {
  processMessage: 'process-message',
  downloadAudio: 'download-audio',
  transcribeAudio: 'transcribe-audio',
  classifyMessage: 'classify-message',
  summarizeChat: 'summarize-chat',
  generateEmbedding: 'generate-embedding',
  detectTask: 'detect-task',
  sendMessage: 'send-message',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const SETTINGS_KEYS = {
  listenPaused: 'listen_paused',
  sendPaused: 'send_paused',
  dailySummaryEnabled: 'daily_summary_enabled',
  dailySummaryHour: 'daily_summary_hour',
  dailySummaryLastDate: 'daily_summary_last_date',
  draftRepliesEnabled: 'draft_replies_enabled',
} as const;

export const MESSAGE_CLASSES = [
  'cliente_caliente',
  'consulta_precio',
  'consulta_financiacion',
  'consulta_permuta',
  'consulta_entrega',
  'documentacion',
  'venta_cerrada',
  'reclamo',
  'grupo_interno',
  'ruido',
] as const;

export type MessageClass = (typeof MESSAGE_CLASSES)[number];

export const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type Priority = (typeof PRIORITIES)[number];

/** Classes that mark a chat/contact as a "hot lead". */
export const HOT_LEAD_CLASSES: MessageClass[] = [
  'cliente_caliente',
  'consulta_precio',
  'consulta_financiacion',
  'consulta_permuta',
  'consulta_entrega',
];

/** Minimum confidence to allow an automatic (commanded) send. */
export const SEND_CONFIDENCE_THRESHOLD = 0.85;

/** WhatsApp JID suffixes. */
export const GROUP_JID_SUFFIX = '@g.us';
export const USER_JID_SUFFIX = '@s.whatsapp.net';

export function isGroupJid(jid: string | null | undefined): boolean {
  return !!jid && jid.endsWith(GROUP_JID_SUFFIX);
}
