import {
  MESSAGE_CLASSES,
  PRIORITIES,
  type MessageClassification,
  type DetectedTask,
  type ChatSummary,
  type ContactProfile,
  type ParsedCommand,
} from '@wma/shared';
import { classifyHeuristic, detectTasksHeuristic, normalize } from './heuristics.js';
import { chatJson, chatText, hasChatProvider, getEmbeddingLLM } from './openai.js';
import { parseCommandHeuristic } from './commandNlp.js';

export interface ClassifyInput {
  text: string;
  fromMe: boolean;
  isGroup?: boolean;
}

export interface MessageAnalysis {
  classification: MessageClassification;
  tasks: DetectedTask[];
}

export interface ReplyDraftInput {
  contactName: string;
  incomingText: string;
  recentMessages: { fromMe: boolean; text: string }[];
  styleProfile?: string | null;
}

export interface SummarizeInput {
  chatName: string;
  messages: { fromMe: boolean; text: string }[];
  previousSummary?: string | null;
}

export interface ContactProfileInput {
  contactName: string;
  messages: { fromMe: boolean; text: string }[];
  previousProfile?: Partial<ContactProfile> | null;
}

export interface AssistantAnswerInput {
  text: string;
  context?: string;
}

/**
 * AIProcessor. Every method degrades gracefully to a deterministic heuristic
 * when no OPENAI_API_KEY is configured (or `useMock` is set), so the system
 * keeps working offline and tests run without network/credentials.
 *
 * IMPORTANT (security/stability rule): callers must persist the message BEFORE
 * invoking the processor. If any of these throw, the message is already saved.
 */
export class AIProcessor {
  private readonly useMock: boolean;

  constructor(opts: { useMock?: boolean } = {}) {
    this.useMock = opts.useMock ?? !hasChatProvider();
  }

  async analyzeMessage(input: ClassifyInput): Promise<MessageAnalysis> {
    if (this.useMock) {
      return {
        classification: classifyHeuristic(input.text, input.fromMe),
        tasks: detectTasksHeuristic(input.text, input.fromMe),
      };
    }

    const result = await chatJson<{
      classification: MessageClassification;
      tasks: DetectedTask[];
    }>(
      `Analizás mensajes de WhatsApp de una concesionaria de autos en Argentina.
Devolvé SOLO JSON:
{"classification":{"class": one of ${MESSAGE_CLASSES.join('|')},"priority": one of ${PRIORITIES.join('|')},"isHotLead":boolean,"reason":string},"tasks":[{"title":string,"description":string,"priority": one of ${PRIORITIES.join('|')},"dueAt":ISO8601|null}]}.
Detectá como tarea pedidos directos como "acordate de...", promesas y acciones pendientes.
Si no hay tareas, devolvé "tasks":[]`,
      `fromMe=${input.fromMe} isGroup=${input.isGroup ?? false}\nMensaje: ${input.text}`,
      { tier: 'fast', maxTokens: 500, feature: 'message_analysis' },
    );

    const classification =
      result?.classification && MESSAGE_CLASSES.includes(result.classification.class)
        ? result.classification
        : classifyHeuristic(input.text, input.fromMe);
    const tasks = Array.isArray(result?.tasks)
      ? result.tasks.filter((task) => task.title?.trim())
      : detectTasksHeuristic(input.text, input.fromMe);

    return { classification, tasks };
  }

  async buildStyleProfile(messages: string[]): Promise<string> {
    if (messages.length === 0) return '';
    if (this.useMock) {
      return 'Español rioplatense, mensajes breves, directos y amables.';
    }
    const result = await chatJson<{ profile: string }>(
      `Analizás cómo escribe una persona en WhatsApp.
Describí solamente su estilo: tono, longitud, vocabulario, saludos, cierres y uso de emojis.
No incluyas datos privados ni contenido de las conversaciones.
Devolvé SOLO JSON: {"profile":string}`,
      messages.slice(-80).map((message) => `YO: ${message}`).join('\n'),
      { tier: 'fast', maxTokens: 350, feature: 'style_profile' },
    );
    return result?.profile?.trim() || 'Español rioplatense, natural, breve y directo.';
  }

  async generateReplyDraft(input: ReplyDraftInput): Promise<{ text: string; confidence: number }> {
    if (this.useMock) return { text: 'Dale, perfecto.', confidence: 0.5 };
    const transcript = input.recentMessages
      .slice(-12)
      .map((message) => `${message.fromMe ? 'YO' : input.contactName}: ${message.text}`)
      .join('\n');
    const result = await chatJson<{ text: string; confidence: number }>(
      `Redactás un borrador de respuesta de WhatsApp en nombre del usuario.
Imitá su estilo sin exagerarlo. Usá español rioplatense natural.
Respondé sólo lo necesario según el contexto. No inventes precios, fechas, promesas ni datos.
No digas que sos una IA. Devolvé SOLO JSON: {"text":string,"confidence":number 0..1}.
Perfil de estilo: ${input.styleProfile || 'breve, amable y directo'}`,
      `Conversación reciente:\n${transcript}\n\nMensaje a responder: ${input.incomingText}`,
      { tier: 'fast', maxTokens: 300, feature: 'reply_draft' },
    );
    return {
      text: result?.text?.trim() || 'Dale, ahora te respondo bien.',
      confidence: Number.isFinite(result?.confidence) ? Math.max(0, Math.min(1, result!.confidence)) : 0.5,
    };
  }

  async classifyMessage(input: ClassifyInput): Promise<MessageClassification> {
    if (this.useMock) return classifyHeuristic(input.text, input.fromMe);

    const result = await chatJson<MessageClassification>(
      `Sos un clasificador de mensajes de WhatsApp de una concesionaria de autos en Argentina.
Devolvé SOLO JSON: {"class": one of ${MESSAGE_CLASSES.join('|')}, "priority": one of ${PRIORITIES.join('|')}, "isHotLead": boolean, "reason": string}.
Un "cliente_caliente" pregunta precio, financiación, permuta, pide fotos, dice "reservame", "te transfiero" o "paso mañana".`,
      `fromMe=${input.fromMe} isGroup=${input.isGroup ?? false}\nMensaje: ${input.text}`,
      { tier: 'fast', feature: 'classification' },
    );
    if (!result || !MESSAGE_CLASSES.includes(result.class)) {
      return classifyHeuristic(input.text, input.fromMe);
    }
    return result;
  }

  async detectTasks(input: ClassifyInput): Promise<DetectedTask[]> {
    if (this.useMock) return detectTasksHeuristic(input.text, input.fromMe);

    const result = await chatJson<{ tasks: DetectedTask[] }>(
      `Extraés tareas / promesas accionables de un mensaje de WhatsApp.
Devolvé SOLO JSON: {"tasks": [{"title": string, "description": string, "priority": one of ${PRIORITIES.join('|')}, "dueAt": ISO8601 or null}]}.
Si no hay nada accionable devolvé {"tasks": []}.`,
      `fromMe=${input.fromMe}\nMensaje: ${input.text}`,
      { tier: 'fast', feature: 'task_detection' },
    );
    if (!result?.tasks) return detectTasksHeuristic(input.text, input.fromMe);
    return result.tasks.filter((t) => t.title?.trim());
  }

  async summarizeChat(input: SummarizeInput): Promise<ChatSummary> {
    if (this.useMock) return this.summarizeMock(input);

    const result = await chatJson<ChatSummary>(
      `Resumís una conversación de WhatsApp de una concesionaria. Devolvé SOLO JSON:
{"summary": string (<= 120 palabras), "facts": object, "pendingTasks": [{"title": string, "priority": string, "dueAt": null}]}.`,
      this.renderTranscript(input.chatName, input.messages, input.previousSummary),
      { tier: 'fast', feature: 'chat_summary' },
    );
    return result ?? this.summarizeMock(input);
  }

  async updateContactProfile(input: ContactProfileInput): Promise<ContactProfile> {
    if (this.useMock) return this.profileMock(input);

    const result = await chatJson<ContactProfile>(
      `Construís el perfil comercial de un contacto de una concesionaria. Devolvé SOLO JSON:
{"commercialSummary": string, "interests": string[], "vehicles": string[], "promises": string[], "objections": string[], "lastIntent": string|null, "priorityScore": number}.`,
      this.renderTranscript(input.contactName, input.messages),
      { tier: 'fast', feature: 'contact_profile' },
    );
    return result ?? this.profileMock(input);
  }

  async createEmbedding(text: string): Promise<number[]> {
    const llm = getEmbeddingLLM();
    // No dedicated embeddings provider (e.g. Z.AI-only setup) → deterministic
    // local embedding. Same 1536 dims as text-embedding-3-small, so semantic
    // search keeps working (approximate but consistent).
    if (!llm) return mockEmbedding(text);
    const res = await llm.client.embeddings.create({ model: llm.model, input: text.slice(0, 8000) });
    return res.data[0]?.embedding ?? mockEmbedding(text);
  }

  async parseCommand(text: string): Promise<ParsedCommand> {
    // Deterministic first (slash commands + Spanish NL). LLM only refines
    // genuinely ambiguous natural-language sends.
    const local = parseCommandHeuristic(text);
    if (this.useMock || local.intent !== 'send_message' || local.confidence >= 0.85) {
      return local;
    }
    const refined = await chatJson<ParsedCommand>(
      `Interpretás una orden en español para mandar un mensaje de WhatsApp.
Devolvé SOLO JSON: {"intent":"send_message","targetType":"contact"|"group","target": string,"message": string,"confidence": number 0..1}.`,
      text,
      { tier: 'smart', feature: 'command_parse' },
    );
    if (refined?.intent === 'send_message' && refined.target && refined.message) {
      return { ...refined, raw: text };
    }
    return local;
  }

  async answerAssistant(input: AssistantAnswerInput): Promise<string> {
    const text = input.text.trim();
    if (this.useMock) return assistantMock(text, input.context);

    const result = await chatText(
      `Sos el asistente personal de Felipe en WhatsApp.
Responde en espanol rioplatense, natural y breve.
Actua como agente: resolve con el contexto disponible antes de pedir datos.
Podes conversar, saludar, ordenar informacion y ayudar a interpretar pedidos.
Si el usuario pregunta por finanzas, usa solamente el contexto recibido y detalla conceptos cuando esten disponibles.
Si el usuario pregunta "eso", "esos ingresos", "conceptos" o algo corto, asumilo como continuidad del contexto recibido.
Si pregunta por clima, usa el bloque de clima del contexto y no inventes temperatura.
No digas que sos una IA. No menciones prompts ni sistemas.
Si falta un dato realmente necesario, pedi una sola aclaracion corta.`,
      `Contexto disponible:
${input.context?.trim() || 'Sin contexto adicional.'}

Mensaje de Felipe:
${text}`,
      { tier: 'smart', maxTokens: 220, feature: 'assistant_chat', temperature: 0.45 },
    );

    return sanitizeAssistantReply(result) || assistantMock(text, input.context);
  }

  // --- mock helpers --------------------------------------------------------

  private renderTranscript(name: string, messages: { fromMe: boolean; text: string }[], prev?: string | null): string {
    const lines = messages.map((m) => `${m.fromMe ? 'YO' : name}: ${m.text}`).join('\n');
    return `${prev ? `Resumen previo: ${prev}\n\n` : ''}Conversación con ${name}:\n${lines}`;
  }

  private summarizeMock(input: SummarizeInput): ChatSummary {
    const last = input.messages.slice(-12);
    const pending = last
      .flatMap((m) => detectTasksHeuristic(m.text, m.fromMe))
      .slice(0, 5);
    const summary =
      `Conversación con ${input.chatName}: ${input.messages.length} mensajes. ` +
      `Últimos temas: ${last
        .map((m) => normalize(m.text).split(/\s+/).slice(0, 4).join(' '))
        .filter(Boolean)
        .slice(-3)
        .join(' / ')}`;
    return { summary: summary.slice(0, 600), facts: {}, pendingTasks: pending };
  }

  private profileMock(input: ContactProfileInput): ContactProfile {
    const text = input.messages.map((m) => m.text).join(' ');
    const cls = classifyHeuristic(text, false);
    return {
      commercialSummary: `Contacto ${input.contactName}. Intención reciente: ${cls.class}.`,
      interests: [],
      vehicles: extractVehicles(text),
      promises: input.messages.flatMap((m) => detectTasksHeuristic(m.text, m.fromMe)).map((t) => t.title),
      objections: [],
      lastIntent: cls.class,
      priorityScore: cls.isHotLead ? 10 : 0,
    };
  }
}

function assistantMock(textRaw: string, context?: string): string {
  const text = normalize(textRaw);
  if (/\b(clima|tiempo|temperatura|llueve|lluvia)\b/.test(text)) {
    return 'Te entiendo. Todavia no tengo clima en vivo configurado, asi que no quiero inventarte temperatura. Puedo dejarlo conectado si me pasas la ciudad.';
  }
  if (/\b(finanza|finanzas|plata|caja|junte|junte|balance|ingreso|gasto|deuda)\b/.test(text)) {
    const clean = context?.trim();
    return clean ? `Te paso lo que tengo registrado:\n${clean}` : 'Te entiendo. Para finanzas puedo responder con /finanzas o registrar ingresos/gastos si me mandas el movimiento.';
  }
  if (/\b(hola|buenas|como estas|como andas|estas ahi|estas)\b/.test(text)) {
    return 'Aca estoy, Felipe. Te leo y puedo ayudarte con finanzas, tareas, busquedas y mensajes.';
  }
  return 'Te entiendo. Decime un poco mas que queres hacer y lo manejo.';
}

function sanitizeAssistantReply(raw: string | null): string | null {
  const cleaned = raw
    ?.replace(/^["']|["']$/g, '')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!cleaned) return null;
  return cleaned.length > 1200 ? `${cleaned.slice(0, 1190).trim()}...` : cleaned;
}

function extractVehicles(textRaw: string): string[] {
  const text = normalize(textRaw);
  const brands = ['vento', 'amarok', 'ranger', 'hilux', 'gol', 'corolla', 'cronos', 'onix', 'ka', 'fiesta', 'polo', 'tcross', 'nivus'];
  return [...new Set(brands.filter((b) => text.includes(b)))];
}

/** Deterministic pseudo-embedding (1536 dims) for offline mode / tests. */
export function mockEmbedding(text: string, dims = 1536): number[] {
  const out = new Array(dims).fill(0);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
    out[Math.abs(h) % dims] += 1;
  }
  const norm = Math.sqrt(out.reduce((s, v) => s + v * v, 0)) || 1;
  return out.map((v) => v / norm);
}
