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

type ModelDetectedTask = DetectedTask & {
  /** Exact source quote used to justify the task. */
  evidence?: string;
  confidence?: number;
};

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

export interface CommandParseOptions {
  /** Loaded lazily only when deterministic parsing cannot resolve the order. */
  context?: () => Promise<string>;
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
        tasks: filterExplicitTasks(input.text, input.fromMe, detectTasksHeuristic(input.text, input.fromMe)),
      };
    }

    const result = await chatJson<{
      classification: MessageClassification;
      tasks: ModelDetectedTask[];
    }>(
      `Analizás mensajes de WhatsApp de una concesionaria de autos en Argentina.
Devolvé SOLO JSON:
{"classification":{"class": one of ${MESSAGE_CLASSES.join('|')},"priority": one of ${PRIORITIES.join('|')},"isHotLead":boolean,"reason":string},"tasks":[{"title":string,"description":string,"priority": one of ${PRIORITIES.join('|')},"dueAt":ISO8601|null,"evidence":string,"confidence":number}]}.
Priorizá precisión: una tarea requiere una obligación explícita, un pedido directo o una nota explícita de pendiente.
Si fromMe=true, sólo es tarea una obligación asumida por Felipe o una nota para sí mismo. Una pregunta, comentario, acción ya realizada o pedido que Felipe le hace a otra persona NO es una tarea de Felipe.
Si fromMe=false, sólo es tarea un pedido explícito dirigido a Felipe o una obligación que requiera seguimiento.
El campo evidence debe ser una cita textual exacta del mensaje. Conservá literalmente nombres, vehículos, montos y monedas en el título.
No inventes "responder al cliente", "contactar", "negociar", "verificar", entregas ni disponibilidad si el mensaje no lo ordena.
Sólo incluí dueAt cuando la fecha u hora esté explícita.
Si no hay tareas, devolvé "tasks":[]`,
      `fromMe=${input.fromMe} isGroup=${input.isGroup ?? false}\nMensaje: ${input.text}`,
      { tier: 'fast', maxTokens: 500, feature: 'message_analysis' },
    );

    const classification =
      result?.classification && MESSAGE_CLASSES.includes(result.classification.class)
        ? result.classification
        : classifyHeuristic(input.text, input.fromMe);
    const tasks = Array.isArray(result?.tasks)
      ? filterExplicitTasks(input.text, input.fromMe, result.tasks)
      : filterExplicitTasks(input.text, input.fromMe, detectTasksHeuristic(input.text, input.fromMe));

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
    if (this.useMock) {
      return filterExplicitTasks(input.text, input.fromMe, detectTasksHeuristic(input.text, input.fromMe));
    }

    const result = await chatJson<{ tasks: ModelDetectedTask[] }>(
      `Extraés tareas con criterio de alta precisión de un mensaje de WhatsApp.
Devolvé SOLO JSON: {"tasks": [{"title": string, "description": string, "priority": one of ${PRIORITIES.join('|')}, "dueAt": ISO8601 or null, "evidence": string, "confidence": number}]}.
La evidencia debe ser una cita textual exacta. No infieras acciones genéricas ni reemplaces nombres, modelos, montos o monedas.
Con fromMe=true aceptá sólo obligaciones de Felipe o notas para sí mismo, nunca preguntas ni pedidos que él hace a otra persona.
Con fromMe=false aceptá sólo pedidos explícitos dirigidos a Felipe u obligaciones que requieren seguimiento.
Si no hay nada accionable devolvé {"tasks": []}.`,
      `fromMe=${input.fromMe}\nMensaje: ${input.text}`,
      { tier: 'fast', feature: 'task_detection' },
    );
    if (!result?.tasks) {
      return filterExplicitTasks(input.text, input.fromMe, detectTasksHeuristic(input.text, input.fromMe));
    }
    return filterExplicitTasks(input.text, input.fromMe, result.tasks);
  }

  async summarizeChat(input: SummarizeInput): Promise<ChatSummary> {
    if (this.useMock) return this.summarizeMock(input);

    const result = await chatJson<ChatSummary>(
      `Resumís una conversación de WhatsApp de una concesionaria. Devolvé SOLO JSON:
{"summary": string (<= 120 palabras), "facts": object, "pendingTasks": [{"title": string, "priority": string, "dueAt": null}]}.
En pendingTasks incluí sólo obligaciones o pedidos explícitos que sigan pendientes. No conviertas preguntas, comentarios, acciones ya hechas ni pedidos del usuario a otra persona en tareas propias. No inventes acciones genéricas como responder, contactar, negociar o verificar. Conservá nombres, vehículos, montos y monedas.`,
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

  async parseCommand(text: string, options: CommandParseOptions = {}): Promise<ParsedCommand> {
    // Deterministic commands remain the fast path. The model is the fallback
    // action router for natural orders that the fixed grammar cannot resolve.
    const local = parseCommandHeuristic(text);
    if (this.useMock || (local.intent !== 'unknown' && local.confidence >= 0.85)) {
      return local;
    }

    const context = (await options.context?.().catch(() => '')) ?? '';
    const refined = await chatJson<ParsedCommand>(
      `Sos el enrutador de acciones del asistente personal de Felipe.
Interpretá órdenes y consultas en español rioplatense. Usá el contexto para resolver referencias como "eso", "el 2", "hacelo" o "agendalo".
No converses ni afirmes que una acción se realizó: devolvé solamente la acción estructurada.

Intenciones disponibles:
- create_task: requiere task.title; puede incluir dueAt, remindAt, priority, recurrence y varias tasks.
- finance_add: requiere finance.kind (income|expense|debt), finance.amount, description y currency.
- finance_summary, pending, agenda_today, summary_today, status, hot_leads, unanswered.
- send_message o send_group: requiere target, message y targetType.
- search, search_audios o chat_lookup: requiere query.
- currency_convert: requiere currency.amount.
- pause_listen, resume_listen, pause_send, resume_send.
- unknown: cuando no pidió una acción disponible o falta un dato indispensable.

Reglas:
- Si la orden es clara, elegí la acción aunque no use una frase exacta de comando.
- No inventes destinatarios, montos, títulos, fechas ni texto de mensajes.
- Una conversación casual sigue siendo unknown.
- Si falta un único dato indispensable, usá intent unknown y una clarification breve y concreta.
- confidence debe reflejar cuán inequívoca es la acción.

Devolvé SOLO un objeto JSON compatible con ParsedCommand.`,
      `Momento actual: ${new Date().toISOString()}
Zona horaria del usuario: America/Argentina/Buenos_Aires

Contexto reciente:
${context || 'Sin contexto anterior útil.'}

Pedido actual de Felipe:
${text}`,
      { tier: 'smart', maxTokens: 700, feature: 'agent_command_parse' },
    );
    return validateAutonomousCommand(refined, text, local);
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
No afirmes que agregaste, editaste, completaste o enviaste algo si el contexto no confirma que esa acción se ejecutó.
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

const QUERY_INTENTS = new Set<ParsedCommand['intent']>([
  'status',
  'summary_today',
  'hot_leads',
  'pending',
  'unanswered',
  'agenda_today',
  'finance_summary',
  'search',
  'search_audios',
  'chat_lookup',
  'currency_convert',
]);

const MUTATING_INTENTS = new Set<ParsedCommand['intent']>([
  'send_message',
  'send_group',
  'pause_listen',
  'resume_listen',
  'pause_send',
  'resume_send',
  'create_task',
  'finance_add',
]);

export function validateAutonomousCommand(
  candidate: Partial<ParsedCommand> | null,
  raw: string,
  fallback: ParsedCommand = { intent: 'unknown', confidence: 0, raw },
): ParsedCommand {
  if (!candidate?.intent) return fallback;
  const confidence = Number(candidate.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return fallback;
  if (!QUERY_INTENTS.has(candidate.intent) && !MUTATING_INTENTS.has(candidate.intent) && candidate.intent !== 'unknown') {
    return fallback;
  }

  if (candidate.intent === 'unknown') {
    const clarification =
      typeof candidate.clarification === 'string' && candidate.clarification.trim()
        ? candidate.clarification.trim().slice(0, 240)
        : undefined;
    return { intent: 'unknown', confidence, raw, clarification };
  }

  const minimum = MUTATING_INTENTS.has(candidate.intent) ? 0.86 : 0.7;
  if (confidence < minimum) {
    return {
      intent: 'unknown',
      confidence,
      raw,
      clarification: 'Entendí la idea, pero necesito que me confirmes exactamente qué querés que haga.',
    };
  }

  if (candidate.intent === 'send_message' || candidate.intent === 'send_group') {
    const target = candidate.target?.trim();
    const message = candidate.message?.trim();
    if (!target || !message) return missingActionField(raw, confidence, '¿A quién y qué mensaje querés que mande?');
    return {
      intent: candidate.intent,
      targetType: candidate.intent === 'send_group' ? 'group' : 'contact',
      target,
      message,
      confidence,
      raw,
    };
  }

  if (candidate.intent === 'create_task') {
    const tasks = candidate.tasks
      ?.filter((task) => !!task?.title?.trim())
      .map(sanitizeAutonomousTask);
    const task = candidate.task?.title?.trim()
      ? sanitizeAutonomousTask(candidate.task)
      : tasks?.[0];
    if (!task) return missingActionField(raw, confidence, '¿Qué tarea querés que agregue?');
    return { intent: 'create_task', task, tasks: tasks && tasks.length > 1 ? tasks : undefined, confidence, raw };
  }

  if (candidate.intent === 'finance_add') {
    const finance = candidate.finance;
    if (
      !finance ||
      !['income', 'expense', 'debt'].includes(finance.kind) ||
      !Number.isFinite(Number(finance.amount)) ||
      Number(finance.amount) <= 0 ||
      !finance.description?.trim()
    ) {
      return missingActionField(raw, confidence, '¿Qué movimiento querés registrar y por qué monto?');
    }
    return {
      intent: 'finance_add',
      finance: {
        ...finance,
        amount: Number(finance.amount),
        description: finance.description.trim(),
        currency: finance.currency === 'USD' ? 'USD' : 'ARS',
      },
      confidence,
      raw,
    };
  }

  if (candidate.intent === 'search' || candidate.intent === 'search_audios' || candidate.intent === 'chat_lookup') {
    const query = candidate.query?.trim();
    if (!query) return missingActionField(raw, confidence, '¿Qué querés que busque?');
    return { intent: candidate.intent, query, confidence, raw };
  }

  if (candidate.intent === 'currency_convert') {
    const amount = Number(candidate.currency?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return missingActionField(raw, confidence, '¿Qué monto en dólares querés convertir?');
    }
    return { intent: 'currency_convert', currency: { amount, from: 'USD', to: 'ARS' }, confidence, raw };
  }

  return { intent: candidate.intent, confidence, raw };
}

function sanitizeAutonomousTask(task: NonNullable<ParsedCommand['task']>): NonNullable<ParsedCommand['task']> {
  return {
    title: task.title.trim(),
    dueAt: validIsoDate(task.dueAt),
    remindAt: validIsoDate(task.remindAt),
    project: task.project?.trim() || null,
    priority: ['low', 'normal', 'high', 'urgent'].includes(String(task.priority))
      ? task.priority
      : 'normal',
    recurrence: ['daily', 'weekly', 'monthly'].includes(String(task.recurrence))
      ? task.recurrence
      : null,
  };
}

function validIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function missingActionField(raw: string, confidence: number, clarification: string): ParsedCommand {
  return { intent: 'unknown', confidence, raw, clarification };
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

/**
 * Final deterministic gate for model-generated tasks. The model may classify
 * freely, but it cannot create a pending item unless the source itself contains
 * an explicit obligation/request signal.
 */
export function filterExplicitTasks(
  textRaw: string,
  fromMe: boolean,
  tasks: ModelDetectedTask[],
): DetectedTask[] {
  if (!hasExplicitTaskSignal(textRaw, fromMe)) return [];
  const source = normalizeForEvidence(textRaw);

  return tasks.filter((task) => {
    if (!task.title?.trim()) return false;
    if (typeof task.confidence === 'number' && task.confidence < 0.8) return false;
    if (task.evidence?.trim()) {
      const evidence = normalizeForEvidence(task.evidence);
      if (evidence.length < 3 || !source.includes(evidence)) return false;
    }
    return true;
  });
}

export function hasExplicitTaskSignal(textRaw: string, fromMe: boolean): boolean {
  const text = normalize(textRaw).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return false;
  if (/\b(?:ya lo hice|ya esta hecho|listo|resuelto|termine|completado)\b/.test(text)) return false;

  if (fromMe) {
    return (
      /\b(?:tengo|tenemos)\s+que\b/.test(text) ||
      /\b(?:debo|debemos|pendiente|tarea|recordame|recuerdame|acordate|acordarte|me falta)\b/.test(text) ||
      /\b(?:te|le)\s+(?:paso|mando|envio|confirmo|aviso|respondo)\b/.test(text)
    );
  }

  return (
    /\b(?:hay|tenemos)\s+que\b/.test(text) ||
    /\b(?:tenes|debes)\s+que\b/.test(text) ||
    /\b(?:necesito|quiero)\s+que\b/.test(text) ||
    /\b(?:pendiente|tarea|recordame|recuerdame|acordate|acordarte|por favor|me falta)\b/.test(text) ||
    /\b(?:podes|podrias)\b/.test(text) ||
    /\b(?:baja|cambia|subi|manda|pasa|confirma|avisa|revisa|verifica|responde|contacta|llama|envia)(?:me|le|lo|la)?\b/.test(
      text,
    )
  );
}

function normalizeForEvidence(text: string): string {
  return normalize(text).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
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
