import type { WASocket } from '@whiskeysockets/baileys';
import { AIProcessor } from '@wma/ai';
import { MessageSender, ContactResolver, buildContext } from '@wma/whatsapp';
import {
  insertCommandLog,
  updateCommandLog,
  setListenPaused,
  setSendPaused,
  isListenPaused,
  isSendPaused,
  statusCounts,
  listHotLeads,
  listTasks,
  unansweredChats,
  searchMessagesText,
  todayMessages,
  insertTask,
  tasksForDay,
  insertFinanceEntry,
  listFinanceEntries,
  financeSummary,
  updateFinanceEntry,
  getSetting,
  setSetting,
} from '@wma/db';
import { connectionState } from './baileys.js';
import { convertUsdToArs, loadEnv, logger, type ParsedCommand } from '@wma/shared';

const ai = new AIProcessor();

/**
 * Dispatch a control-chat command and return the text to reply with.
 * Caller guarantees this is only invoked for messages that are fromMe AND from
 * CONTROL_CHAT_JID (spec §6 rules 2 & 3).
 */
export async function handleControlCommand(
  sock: WASocket,
  text: string,
  sourceMessageId: string | null,
  sourceChatId: string,
  options: { allowConversation?: boolean } = {},
): Promise<string | null> {
  const parsed = await ai.parseCommand(text);
  if (parsed.intent === 'unknown') {
    if (options.allowConversation !== false) {
      const financeReply = await handleFinanceAgentText(text);
      if (financeReply) {
        await setSetting('last_assistant_topic', 'finance');
        const logId = await insertCommandLog({
          sourceMessageId,
          commandText: text,
          parsedIntent: 'unknown',
          parsedPayload: { financeAgent: true },
          status: 'parsed',
        });
        await updateCommandLog(logId, { status: 'done' });
        return financeReply;
      }
    }
    if (shouldAnswerConversationally(text, options)) {
      const logId = await insertCommandLog({
        sourceMessageId,
        commandText: text,
        parsedIntent: 'unknown',
        parsedPayload: { conversational: true },
        status: 'parsed',
      });
      try {
        const reply = await ai.answerAssistant({
          text,
          context: await buildAssistantContext(text),
        });
        await rememberAssistantTopic(text);
        await updateCommandLog(logId, { status: 'done' });
        return reply;
      } catch (err) {
        const m = (err as Error).message;
        logger.error({ logId, err: m }, 'assistant chat failed');
        await updateCommandLog(logId, { status: 'error', error: m });
        return 'Te lei, pero ahora no pude generar una respuesta. Proba de nuevo en un minuto.';
      }
    }
    if (!looksLikeControlCommand(text)) return null;
    const logId = await insertCommandLog({
      sourceMessageId,
      commandText: text,
      parsedIntent: 'unknown',
      parsedPayload: {},
      status: 'ignored',
      error: 'unrecognized_command',
    });
    await updateCommandLog(logId, { status: 'ignored', error: 'unrecognized_command' });
    return null;
  }

  const logId = await insertCommandLog({
    sourceMessageId,
    commandText: text,
    parsedIntent: parsed.intent,
    parsedPayload: { targetType: parsed.targetType, hasMessage: !!parsed.message, confidence: parsed.confidence },
    status: 'parsed',
  });

  try {
    const reply = await execute(sock, parsed, sourceMessageId, sourceChatId);
    await updateCommandLog(logId, { status: 'done' });
    return reply;
  } catch (err) {
    const m = (err as Error).message;
    logger.error({ logId, intent: parsed.intent, err: m }, 'command failed');
    await updateCommandLog(logId, { status: 'error', error: m });
    return `⚠️ Error ejecutando ${parsed.intent}: ${m}`;
  }
}

async function execute(
  sock: WASocket,
  cmd: ParsedCommand,
  sourceMessageId: string | null,
  sourceChatId: string,
): Promise<string> {
  const env = loadEnv();
  switch (cmd.intent) {
    case 'status': {
      const s = await statusCounts();
      const listen = (await isListenPaused()) ? '⏸️ pausada' : '▶️ activa';
      const send = (await isSendPaused()) ? '⏸️ pausados' : '▶️ activos';
      return [
        `📊 *Estado*`,
        `WhatsApp: ${connectionState.connected ? '🟢 conectado' : '🔴 desconectado'}`,
        `Escucha: ${listen}`,
        `Envíos: ${send} (auto_send=${env.ENABLE_AUTO_SEND})`,
        `Chats: ${s.chats} · Contactos: ${s.contacts}`,
        `Pendientes: ${s.pendingTasks} · Clientes calientes: ${s.hotLeads}`,
        `Audios sin transcribir: ${s.pendingAudios}`,
        `Último mensaje: ${s.lastMessageAt ?? '—'}`,
      ].join('\n');
    }

    case 'summary_today': {
      await setSetting('last_assistant_topic', 'daily');
      const daily = await buildDailyBriefText();
      const rows = await todayMessages(400);
      if (rows.length === 0) return daily;
      const messages = rows
        .map((r: any) => ({ fromMe: !!r.from_me, text: r.text_content ?? '' }))
        .filter((m) => m.text.trim());
      const summary = await ai.summarizeChat({ chatName: 'Hoy', messages });
      const pend = summary.pendingTasks.slice(0, 8).map((t) => `• ${t.title}`).join('\n');
      return `🗒️ *Resumen de hoy*\n${summary.summary}${pend ? `\n\nPendientes detectados:\n${pend}` : ''}`;
    }

    case 'hot_leads': {
      const leads = await listHotLeads(15);
      if (leads.length === 0) return 'No hay clientes calientes por ahora.';
      return `🔥 *Clientes calientes*\n${leads
        .map((l: any, i: number) => `${i + 1}. ${l.display_name} (score ${l.priority_score})${l.last_intent ? ` — ${l.last_intent}` : ''}`)
        .join('\n')}`;
    }

    case 'pending': {
      await setSetting('last_assistant_topic', 'tasks');
      const tasks = await listTasks('pending');
      if (tasks.length === 0) return 'No hay pendientes. ✅';
      return `📌 *Pendientes*\n${tasks
        .slice(0, 20)
        .map((t: any, i: number) => `${i + 1}. ${t.title}${t.chat_name ? ` (${t.chat_name})` : ''}`)
        .join('\n')}`;
    }

    case 'agenda_today': {
      await setSetting('last_assistant_topic', 'tasks');
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const tasks = await tasksForDay(start.toISOString(), end.toISOString());
      if (tasks.length === 0) return 'Hoy no tenés tareas con horario. ✅';
      return `📅 *Agenda de hoy*\n${tasks
        .map((task: any, i: number) => {
          const time = new Date(task.due_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
          return `${i + 1}. ${time} · ${task.title}`;
        })
        .join('\n')}`;
    }

    case 'create_task': {
      if (!cmd.task?.title) return 'No pude identificar la tarea.';
      const id = await insertTask({
        chatId: sourceChatId,
        task: {
          title: cmd.task.title,
          priority: cmd.task.priority ?? 'normal',
          dueAt: cmd.task.dueAt ?? null,
        },
        sourceMessageId,
        project: cmd.task.project ?? null,
        remindAt: cmd.task.remindAt ?? null,
        source: 'manual_whatsapp',
        recurrence: cmd.task.recurrence ?? null,
      });
      const due = cmd.task.dueAt
        ? new Date(cmd.task.dueAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
        : 'sin fecha';
      const reminder = cmd.task.remindAt
        ? `\n🔔 Aviso: ${new Date(cmd.task.remindAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}`
        : '';
      return `✅ *Tarea creada*\n${cmd.task.title}\n📅 ${due}${reminder}\nID: ${id.slice(0, 8)}`;
    }

    case 'finance_add': {
      if (!cmd.finance) return 'No pude identificar el movimiento.';
      const finance = cmd.finance;
      const components = finance.components?.length
        ? finance.components
        : [{ amount: finance.amount, currency: finance.currency ?? 'ARS' }];
      let amount = 0;
      let description = finance.description;
      const conversionLines: string[] = [];
      for (const component of components) {
        if (component.currency === 'USD') {
          const converted = await convertUsdToArs(component.amount);
          amount += converted.ars;
          conversionLines.push(
            `${formatUsd(component.amount)} = ${formatArs(converted.ars)} (blue venta ${formatArs(converted.rate.sell)}, ${converted.rate.source})`,
          );
        } else {
          amount += component.amount;
        }
      }
      if (components.some((component) => component.currency === 'USD')) {
        description = `${description} (${components.map(formatFinanceComponent).join(' + ')})`;
      }
      const id = await insertFinanceEntry({
        ...finance,
        amount,
        currency: 'ARS',
        description,
        sourceMessageId,
      });
      await setSetting('last_assistant_topic', 'finance');
      const type = finance.kind === 'income' ? 'Ingreso' : finance.kind === 'expense' ? 'Gasto' : 'Deuda';
      return `*${type} registrado*\n${formatArs(amount)}${conversionLines.length ? `\n${conversionLines.join('\n')}` : ''}\n${description}\nID: ${id.slice(0, 8)}`;
    }

    case 'currency_convert': {
      if (!cmd.currency) return 'No pude identificar el monto.';
      const currency = cmd.currency;
      const converted = await convertUsdToArs(currency.amount);
      return [
        `${formatUsd(currency.amount)} son ${formatArs(converted.ars)}`,
        `Dolar blue venta: ${formatArs(converted.rate.sell)}`,
        `Fuente: ${converted.rate.source}${converted.rate.updatedAt ? ` - ${new Date(converted.rate.updatedAt).toLocaleString('es-AR')}` : ''}`,
      ].join('\n');
    }

    case 'finance_summary': {
      await setSetting('last_assistant_topic', 'finance');
      const summary = await financeSummary();
      const income = Number(summary.income ?? 0);
      const expenses = Number(summary.expenses ?? 0);
      const debt = Number(summary.pending_debt ?? 0);
      const details = await financeBreakdownText({ compact: true });
      return [
        '💰 *Finanzas del mes*',
        `Ingresos: $ ${income.toLocaleString('es-AR')}`,
        `Gastos: $ ${expenses.toLocaleString('es-AR')}`,
        `Balance: $ ${(income - expenses).toLocaleString('es-AR')}`,
        `Deudas pendientes: $ ${debt.toLocaleString('es-AR')}`,
        details ? `\n${details}` : '',
      ].join('\n');
    }

    case 'unanswered': {
      const chats = await unansweredChats(20);
      if (chats.length === 0) return 'No hay chats sin responder. ✅';
      return `📭 *Sin responder*\n${chats
        .map((c: any, i: number) => `${i + 1}. ${c.display_name}`)
        .join('\n')}`;
    }

    case 'search': {
      const rows = await searchMessagesText(cmd.query ?? '', { limit: 15 });
      if (rows.length === 0) return `Sin resultados para "${cmd.query}".`;
      return `🔎 *Resultados*\n${rows
        .map((r: any) => `• [${r.chat_name}] ${truncate(r.text_content)}`)
        .join('\n')}`;
    }

    case 'search_audios': {
      const rows = await searchMessagesText(cmd.query ?? '', { onlyAudio: true, limit: 15 });
      if (rows.length === 0) return `Sin audios para "${cmd.query}".`;
      return `🎙️ *Audios*\n${rows.map((r: any) => `• [${r.chat_name}] ${truncate(r.transcript)}`).join('\n')}`;
    }

    case 'chat_lookup': {
      const res = await new ContactResolver().resolveContact(cmd.query ?? '');
      if (res.status !== 'resolved') return `No pude identificar el chat "${cmd.query}".`;
      const ctx = await buildContext(res.chatId, { ai });
      return `💬 *${res.displayName}*\n${ctx.chatSummary || 'Sin resumen aún.'}\nÚltimos: ${ctx.recentMessages
        .slice(-3)
        .map((m) => truncate(m.text))
        .join(' | ')}`;
    }

    case 'send_message':
    case 'send_group': {
      const sender = new MessageSender(sock);
      const outcome = await sender.send({
        targetType: cmd.intent === 'send_group' ? 'group' : 'contact',
        target: cmd.target ?? '',
        message: cmd.message ?? '',
        confidence: cmd.confidence,
        requestedBy: 'control_chat',
        sourceChatId: env.CONTROL_CHAT_JID ?? null,
      });
      return outcome.reply ?? `Acción ${outcome.status}.`;
    }

    case 'pause_listen':
      await setListenPaused(true);
      return '⏸️ Escucha pausada.';
    case 'resume_listen':
      await setListenPaused(false);
      return '▶️ Escucha reanudada.';
    case 'pause_send':
      await setSendPaused(true);
      return '⏸️ Envíos pausados.';
    case 'resume_send':
      await setSendPaused(false);
      return '▶️ Envíos reanudados.';

    default:
      return 'Comando no reconocido.';
  }
}

function formatArs(amount: number): string {
  return amount.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  });
}

function formatUsd(amount: number): string {
  return amount.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function formatFinanceComponent(component: { amount: number; currency: 'ARS' | 'USD' }): string {
  return component.currency === 'USD' ? formatUsd(component.amount) : formatArs(component.amount);
}

async function handleFinanceAgentText(text: string): Promise<string | null> {
  if (/\b(deshacer|deshace|reverti|revertir|volver atras|volver atrás)\b/i.test(text)) {
    return undoLastFinanceChange();
  }

  const correction = parseFinanceSplitCorrection(text);
  if (correction) return applyFinanceSplitCorrection(correction);

  const lastTopic = await getSetting<string>('last_assistant_topic');
  if (isFinanceDetailRequest(text) || (lastTopic === 'finance' && isFinanceFollowUp(text))) {
    const kinds = requestedFinanceKinds(text);
    const details = await financeBreakdownText({ compact: false, kinds });
    if (!details) return 'No tengo movimientos cargados para ese detalle todavia.';
    return `Te detallo lo que esta cargado este mes:\n\n${details}`;
  }

  return null;
}

type FinanceComponent = { amount: number; currency: 'ARS' | 'USD' };
type FinanceReplacement = { description: string; components: FinanceComponent[] };
type FinanceSplitCorrection = { oldTotal: number | null; replacements: FinanceReplacement[] };

async function applyFinanceSplitCorrection(correction: FinanceSplitCorrection): Promise<string> {
  const entries = await listFinanceEntries(200);
  const incomes = entries.filter(
    (entry: any) => entry.kind === 'income' && entry.status !== 'cancelled' && isCurrentMonth(entry.occurred_at),
  );
  const target = findIncomeToReplace(incomes, correction);

  if (!target) {
    const current = incomes.length
      ? incomes.map((entry: any) => `- ${formatArs(Number(entry.amount ?? 0))} · ${entry.description}`).join('\n')
      : 'No hay ingresos activos este mes.';
    return [
      'Te entendi la correccion, pero no encontre un ingreso unico para reemplazar sin riesgo.',
      'Ingresos actuales:',
      current,
      'Decime por ejemplo: "corregi el ingreso de Jesus Diaz: 700k + 50usd Jesus Diaz y 200k lavado C4 Cactus".',
    ].join('\n');
  }

  const replacements = await Promise.all(correction.replacements.map(resolveFinanceReplacement));
  const replacementForTarget = chooseReplacementForTarget(replacements, target);
  const undo = {
    target: {
      id: target.id,
      amount: Number(target.amount ?? 0),
      description: target.description,
      category: target.category ?? null,
      status: target.status,
    },
    insertedIds: [] as string[],
    createdAt: new Date().toISOString(),
  };
  await updateFinanceEntry(target.id, {
    amount: replacementForTarget.amount,
    description: replacementForTarget.description,
    status: 'paid',
  });

  const inserted: typeof replacements = [];
  for (const replacement of replacements) {
    if (replacement === replacementForTarget) continue;
    if (hasSimilarIncome(incomes, replacement)) continue;
    const id = await insertFinanceEntry({
      kind: 'income',
      amount: replacement.amount,
      currency: 'ARS',
      description: replacement.description,
      sourceMessageId: null,
    });
    undo.insertedIds.push(id);
    inserted.push(replacement);
  }
  await setSetting('last_finance_undo', undo);

  const summary = await financeSummary();
  const income = Number(summary.income ?? 0);
  return [
    'Listo, lo deje corregido en finanzas:',
    `- Actualice ${target.description} -> ${formatArs(replacementForTarget.amount)} · ${replacementForTarget.description}`,
    ...inserted.map((entry) => `- Agregue ${formatArs(entry.amount)} · ${entry.description}`),
    '',
    `Ingresos del mes ahora: ${formatArs(income)}`,
    await financeBreakdownText({ compact: false, kinds: ['income'] }),
  ]
    .filter(Boolean)
    .join('\n');
}

async function undoLastFinanceChange(): Promise<string> {
  const undo = await getSetting<{
    target?: { id: string; amount: number; description: string; category: string | null; status: string };
    insertedIds?: string[];
    createdAt?: string;
  }>('last_finance_undo');

  if (!undo?.target?.id) return 'No tengo un cambio financiero reciente para deshacer.';

  await updateFinanceEntry(undo.target.id, {
    amount: undo.target.amount,
    description: undo.target.description,
    category: undo.target.category,
    status: undo.target.status,
  });

  for (const id of undo.insertedIds ?? []) {
    await updateFinanceEntry(id, { status: 'cancelled' });
  }

  await setSetting('last_finance_undo', null);
  const summary = await financeSummary();
  return [
    'Listo, deshice el ultimo cambio financiero.',
    `Restaure: ${undo.target.description} (${formatArs(undo.target.amount)})`,
    undo.insertedIds?.length ? `Cancele ${undo.insertedIds.length} movimiento(s) agregado(s).` : '',
    `Ingresos del mes ahora: ${formatArs(Number(summary.income ?? 0))}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function parseFinanceSplitCorrection(text: string): FinanceSplitCorrection | null {
  if (!/\b(divid|separ|correg|confund|quedar|serian|serían|cosas aparte|son\s+(?:2|dos)\s+cosas)\b/i.test(text)) {
    return null;
  }

  const trigger = lastCorrectionTrigger(text);
  if (!trigger) return null;
  const before = text.slice(0, trigger.index);
  const after = text.slice(trigger.index + trigger.length);
  const oldTotal = extractFinanceComponents(before).at(-1)?.amount ?? null;
  const replacements = splitFinanceReplacementText(after)
    .map(parseFinanceReplacement)
    .filter((entry): entry is FinanceReplacement => !!entry);

  if (replacements.length < 2) return null;
  return { oldTotal, replacements };
}

function lastCorrectionTrigger(text: string): { index: number; length: number } | null {
  const pattern = /\b(serian|serían|quedarian|quedarían|quedaria|quedaría|son\s+(?:2|dos)\s+cosas|cosas aparte)\b/gi;
  let last: { index: number; length: number } | null = null;
  for (const match of text.matchAll(pattern)) {
    last = { index: match.index ?? 0, length: match[0]!.length };
  }
  return last;
}

function splitFinanceReplacementText(text: string): string[] {
  return text
    .replace(/^[\s:,-]+/, '')
    .split(/\s+y\s+(?=(?:\$|ars\s*)?\s*\d|(?:usd|u\$s)\s*\d)/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseFinanceReplacement(text: string): FinanceReplacement | null {
  const components = extractFinanceComponents(text);
  if (components.length === 0) return null;
  const description = titleCase(cleanFinanceText(stripFinanceComponentText(text)));
  if (!description) return null;
  return { description, components };
}

function extractFinanceComponents(text: string): FinanceComponent[] {
  const components: FinanceComponent[] = [];
  const pattern =
    /(?:(usd|u\$s|dolares|dólares|dolar|dólar)\s*)?(?:\$|ars\s*)?\s*([\d.,]+)\s*([km])?\s*(usd|u\$s|dolares|dólares|dolar|dólar)?/gi;

  for (const match of text.matchAll(pattern)) {
    const amount = parseAgentMoneyAmount(match[2]!, match[3]?.toLowerCase() as 'k' | 'm' | undefined);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const currency = match[1] || match[4] ? 'USD' : 'ARS';
    components.push({ amount, currency });
  }
  return components;
}

function stripFinanceComponentText(text: string): string {
  return text
    .replace(
      /(?:(?:usd|u\$s|dolares|dólares|dolar|dólar)\s*)?(?:\$|ars\s*)?\s*[\d.,]+\s*[km]?\s*(?:usd|u\$s|dolares|dólares|dolar|dólar)?/gi,
      ' ',
    )
    .replace(/\+/g, ' ')
    .replace(/\bal\s+blue\b/gi, ' ')
    .replace(/\bpesos?\s*(?:arg(?:entinos?)?)?\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanFinanceText(text: string): string {
  return text
    .replace(/^(?:de|del|por|para|son|es)\s+/i, '')
    .replace(/\s+/g, ' ')
    .replace(/^[,;:\s]+|[,;:\s]+$/g, '')
    .trim();
}

function parseAgentMoneyAmount(value: string, suffix?: 'k' | 'm'): number {
  const normalized = suffix ? value.replace(',', '.') : value.replace(/\./g, '').replace(',', '.');
  const amount = Number(normalized);
  if (suffix === 'm') return amount * 1_000_000;
  if (suffix === 'k') return amount * 1_000;
  return amount;
}

async function resolveFinanceReplacement(replacement: FinanceReplacement): Promise<{
  description: string;
  amount: number;
  components: FinanceComponent[];
}> {
  let amount = 0;
  const conversionParts: string[] = [];
  for (const component of replacement.components) {
    if (component.currency === 'USD') {
      const converted = await convertUsdToArs(component.amount);
      amount += converted.ars;
      conversionParts.push(formatUsd(component.amount));
    } else {
      amount += component.amount;
      conversionParts.push(formatArs(component.amount));
    }
  }
  const description =
    replacement.components.length > 1 ? `${replacement.description} (${conversionParts.join(' + ')})` : replacement.description;
  return { description, amount, components: replacement.components };
}

function findIncomeToReplace(incomes: any[], correction: FinanceSplitCorrection): any | null {
  if (correction.oldTotal !== null) {
    const byAmount = incomes.find((entry) => Math.abs(Number(entry.amount ?? 0) - correction.oldTotal!) < 1);
    if (byAmount) return byAmount;
  }
  if (incomes.length === 1) return incomes[0];

  const descriptions = correction.replacements.map((entry) => normalizeForMatch(entry.description));
  return (
    incomes.find((entry) => {
      const current = normalizeForMatch(entry.description ?? '');
      return descriptions.some((description) => description && current.includes(description.split(' ')[0] ?? description));
    }) ?? null
  );
}

function chooseReplacementForTarget<T extends { description: string }>(replacements: T[], target: any): T {
  const current = normalizeForMatch(target.description ?? '');
  return (
    replacements.find((replacement) => {
      const words = normalizeForMatch(replacement.description).split(/\s+/).filter((word) => word.length > 2);
      return words.some((word) => current.includes(word));
    }) ?? replacements[0]!
  );
}

function hasSimilarIncome(existing: any[], replacement: { amount: number; description: string }): boolean {
  const replacementText = normalizeForMatch(replacement.description);
  return existing.some((entry) => {
    if (entry.status === 'cancelled' || entry.kind !== 'income') return false;
    const sameAmount = Math.abs(Number(entry.amount ?? 0) - replacement.amount) < 1;
    const current = normalizeForMatch(entry.description ?? '');
    return sameAmount && (current.includes(replacementText) || replacementText.includes(current));
  });
}

function isFinanceDetailRequest(text: string): boolean {
  return (
    /\b(detalla|detallame|detalle|desglosa|desglosame|concepto|conceptos|de\s+q(?:ue)?\s+es|por\s+q(?:ue)?|porque)\b/i.test(
      text,
    ) && /\b(finanza|ingreso|ingresos|gasto|gastos|deuda|deudas|monto|total|balance)\b/i.test(text)
  );
}

function isFinanceFollowUp(text: string): boolean {
  return /\b(concepto|conceptos|detalle|detallame|ingreso|ingresos|gasto|gastos|deuda|deudas|eso|esos|monto|total|porque|por que|de que|de q)\b/i.test(
    text,
  );
}

function requestedFinanceKinds(text: string): FinanceKind[] {
  const kinds: FinanceKind[] = [];
  if (/\bingres/i.test(text)) kinds.push('income');
  if (/\bgast/i.test(text)) kinds.push('expense');
  if (/\bdeud/i.test(text)) kinds.push('debt');
  return kinds.length ? kinds : ['income', 'expense', 'debt'];
}

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function titleCase(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (word.length <= 3 ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
    .join(' ');
}

async function buildAssistantContext(text: string): Promise<string> {
  const lower = text.toLowerCase();
  const lines: string[] = [];
  const lastTopic = await getSetting<string>('last_assistant_topic');

  if (
    /\b(finanza|finanzas|plata|caja|junt|balance|ingreso|gasto|deuda|concepto|conceptos|monto|importe|total|registrado)\b/i.test(
      lower,
    ) ||
    lastTopic === 'finance' ||
    /\b(?:de\s+)?q(?:ue)?\s+es\b/i.test(lower)
  ) {
    const summary = await financeSummary();
    const income = Number(summary.income ?? 0);
    const expenses = Number(summary.expenses ?? 0);
    const debt = Number(summary.pending_debt ?? 0);
    lines.push(
      [
        'Finanzas registradas del mes:',
        `Ingresos: ${formatArs(income)}`,
        `Gastos: ${formatArs(expenses)}`,
        `Balance: ${formatArs(income - expenses)}`,
        `Deudas pendientes: ${formatArs(debt)}`,
      ].join('\n'),
    );
    const breakdown = await financeBreakdownText({ compact: false });
    if (breakdown) lines.push(breakdown);
  }

  if (/\b(clima|tiempo|temperatura|llueve|lluvia)\b/i.test(lower)) {
    lines.push(await weatherContext());
  }

  if (/\b(status|estado|estas ahi|funciona|conectado|como voy|como vengo|resumen|hoy|agenda|pendiente|pendientes)\b/i.test(lower)) {
    const s = await statusCounts();
    lines.push(
      [
        'Estado del sistema:',
        `WhatsApp: ${connectionState.connected ? 'conectado' : 'desconectado'}`,
        `Chats: ${s.chats}`,
        `Contactos: ${s.contacts}`,
        `Pendientes: ${s.pendingTasks}`,
        `Clientes calientes: ${s.hotLeads}`,
        `Ultimo mensaje: ${s.lastMessageAt ?? 'sin dato'}`,
      ].join('\n'),
    );
  }

  if (/\b(tarea|tareas|pendiente|pendientes|agenda|hoy|manana|mañana|recordatorio|recordatorios|como voy|como vengo|resumen)\b/i.test(lower)) {
    const pending = await listTasks('pending');
    const top = pending.slice(0, 8);
    lines.push(
      [
        `Pendientes activos: ${pending.length}`,
        ...top.map((task: any, index: number) => {
          const due = task.due_at ? ` - vence ${new Date(task.due_at).toLocaleString('es-AR')}` : '';
          return `${index + 1}. ${task.title}${due}`;
        }),
      ].join('\n'),
    );
  }

  return lines.join('\n\n');
}

async function rememberAssistantTopic(text: string): Promise<void> {
  if (/\b(finanza|finanzas|plata|caja|ingreso|ingresos|gasto|gastos|deuda|deudas|dolar|usd)\b/i.test(text)) {
    await setSetting('last_assistant_topic', 'finance');
    return;
  }
  if (/\b(tarea|tareas|pendiente|pendientes|agenda|recordatorio|hoy|manana|mañana)\b/i.test(text)) {
    await setSetting('last_assistant_topic', 'tasks');
    return;
  }
  if (/\b(clima|tiempo|temperatura|llueve|lluvia)\b/i.test(text)) {
    await setSetting('last_assistant_topic', 'weather');
  }
}

async function weatherContext(): Promise<string> {
  try {
    const response = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=-34.6037&longitude=-58.3816&current=temperature_2m,apparent_temperature,precipitation,wind_speed_10m&timezone=America%2FArgentina%2FBuenos_Aires',
      { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8_000) },
    );
    if (!response.ok) throw new Error(`weather ${response.status}`);
    const data = (await response.json()) as {
      current?: {
        temperature_2m?: number;
        apparent_temperature?: number;
        precipitation?: number;
        wind_speed_10m?: number;
      };
    };
    const current = data.current;
    if (!current) throw new Error('weather missing current');
    return [
      'Clima actual estimado para Buenos Aires:',
      `Temperatura: ${Math.round(Number(current.temperature_2m))} C`,
      `Sensacion: ${Math.round(Number(current.apparent_temperature))} C`,
      `Lluvia: ${Number(current.precipitation ?? 0)} mm`,
      `Viento: ${Math.round(Number(current.wind_speed_10m ?? 0))} km/h`,
    ].join('\n');
  } catch {
    return 'Clima: no pude consultar el clima en vivo ahora. Ciudad por defecto configurada: Buenos Aires.';
  }
}

export async function buildDailyBriefText(): Promise<string> {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const [today, pending, finances] = await Promise.all([
    tasksForDay(start.toISOString(), end.toISOString()),
    listTasks('pending'),
    financeSummary(),
  ]);
  const overdue = pending.filter((task: any) => task.due_at && new Date(task.due_at).getTime() < now.getTime());
  const income = Number(finances.income ?? 0);
  const expenses = Number(finances.expenses ?? 0);
  const debt = Number(finances.pending_debt ?? 0);
  const todayLines = today.length
    ? today
        .slice(0, 8)
        .map((task: any) => {
          const time = task.due_at ? new Date(task.due_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '--:--';
          return `- ${time} ${task.title}`;
        })
        .join('\n')
    : '- Sin tareas con horario';
  const overdueLines = overdue.length
    ? overdue.slice(0, 5).map((task: any) => `- ${task.title}`).join('\n')
    : '- Nada vencido';
  const financeDetails = await financeBreakdownText({ compact: true, kinds: ['income'] });

  return [
    '*Resumen de hoy*',
    '',
    '*Agenda*',
    todayLines,
    '',
    '*Vencidos*',
    overdueLines,
    '',
    '*Finanzas del mes*',
    `Ingresos: ${formatArs(income)}`,
    `Gastos: ${formatArs(expenses)}`,
    `Balance: ${formatArs(income - expenses)}`,
    `Deudas: ${formatArs(debt)}`,
    financeDetails ? `\n${financeDetails}` : '',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

type FinanceKind = 'income' | 'expense' | 'debt';

async function financeBreakdownText(options: { compact: boolean; kinds?: FinanceKind[] }): Promise<string> {
  const entries = await listFinanceEntries(200);
  const current = entries.filter((entry: any) => isCurrentMonth(entry.occurred_at));
  if (current.length === 0) return '';

  const kinds = new Set<FinanceKind>(options.kinds ?? ['income', 'expense', 'debt']);
  const sections = [
    kinds.has('income')
      ? renderFinanceKind(
          'Ingresos',
          current.filter((entry: any) => entry.kind === 'income' && entry.status !== 'cancelled'),
          options.compact ? 5 : 12,
        )
      : '',
    kinds.has('expense')
      ? renderFinanceKind(
          'Gastos',
          current.filter((entry: any) => entry.kind === 'expense' && entry.status !== 'cancelled'),
          options.compact ? 5 : 12,
        )
      : '',
    kinds.has('debt')
      ? renderFinanceKind(
          'Deudas pendientes',
          current.filter((entry: any) => entry.kind === 'debt' && entry.status === 'pending'),
          options.compact ? 5 : 12,
        )
      : '',
  ].filter(Boolean);

  return sections.join('\n');
}

function renderFinanceKind(title: string, entries: any[], limit: number): string {
  if (entries.length === 0) return '';
  const total = entries.reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0);
  const lines = entries.slice(0, limit).map((entry) => {
    const date = entry.occurred_at ? new Date(entry.occurred_at).toLocaleDateString('es-AR') : 'sin fecha';
    const category = entry.category ? ` · ${entry.category}` : '';
    return `- ${formatArs(Number(entry.amount ?? 0))} · ${entry.description}${category} · ${date}`;
  });
  const hidden = entries.length > limit ? `\n- ... y ${entries.length - limit} mas` : '';
  return `*${title}* (${formatArs(total)})\n${lines.join('\n')}${hidden}`;
}

function isCurrentMonth(value: string | Date | null | undefined): boolean {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function shouldAnswerConversationally(text: string, options: { allowConversation?: boolean }): boolean {
  if (options.allowConversation === false) return false;
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 1000) return false;
  if (/^No pude interpretar ese comando\./i.test(trimmed)) return false;
  if (/^Error ejecutando\b/i.test(trimmed)) return false;
  return true;
}

export function looksLikeControlCommand(text: string): boolean {
  const firstLine = text
    .trim()
    .split(/\r?\n/)
    .find((line) => line.trim().length > 0)
    ?.trim() ?? '';

  return (
    /^(\/|gasto|gaste|pago|pague|ingreso|cobro|cobre|gane|deuda|debo|tarea|pendiente|recordame|anota|cuanto|dolar|usd)\b/i.test(
      firstLine,
    ) || /^(?:.*\s)?(\$|usd|u\$s|\b\d+[\.,]?\d*\s*[km]\b)/i.test(firstLine)
  );
}

function truncate(s: string | null | undefined, n = 80): string {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}
