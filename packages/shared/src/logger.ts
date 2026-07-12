import pino from 'pino';

/**
 * Structured logger.
 *
 * Security rule #12: we NEVER log full message bodies. The helper
 * `safeMessageLog` extracts only metadata that is safe to record.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: undefined,
  redact: {
    paths: [
      'text',
      'text_content',
      'message',
      'transcript',
      'body',
      '*.text',
      '*.message',
      'payload.message',
    ],
    censor: '[redacted]',
  },
});

export type LoggableMessage = {
  id?: string;
  chatId?: string;
  messageType?: string;
  fromMe?: boolean;
  timestamp?: number | string | Date | null;
};

/** Returns a safe, content-free representation of a message for logging. */
export function safeMessageLog(m: LoggableMessage): Record<string, unknown> {
  return {
    messageId: m.id,
    chatId: m.chatId,
    type: m.messageType,
    fromMe: m.fromMe ?? false,
    timestamp:
      m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp ?? null,
  };
}

export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
