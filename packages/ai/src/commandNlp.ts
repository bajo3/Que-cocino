import type { ParsedCommand, CommandIntent } from '@wma/shared';

/**
 * Deterministic command parser.
 *
 * Handles the exact slash commands from the spec plus Spanish natural-language
 * send orders ("mandale a Juan que ...", "decile al grupo Ventas que ...").
 * Returns a ParsedCommand with a confidence the caller uses to decide whether
 * to act or ask for clarification.
 */
export function parseCommandHeuristic(input: string, now = new Date()): ParsedCommand {
  const raw = input.trim();
  const lower = raw.toLowerCase();

  const simple = (intent: CommandIntent): ParsedCommand => ({ intent, confidence: 1, raw });

  // --- exact slash commands ------------------------------------------------
  if (lower === '/status') return simple('status');
  if (lower === '/resumen hoy') return simple('summary_today');
  if (lower === '/clientes calientes') return simple('hot_leads');
  if (lower === '/pendientes') return simple('pending');
  if (/^(?:mis\s+)?pendientes\s*[?¿!]*$/i.test(lower)) return simple('pending');
  if (lower === '/agenda' || lower === '/hoy' || lower === 'que tengo hoy' || lower === 'qué tengo hoy') {
    return simple('agenda_today');
  }
  if (lower === '/sin-responder') return simple('unanswered');
  if (lower === '/pausar') return simple('pause_listen');
  if (lower === '/reanudar') return simple('resume_listen');
  if (lower === '/pausar-envios') return simple('pause_send');
  if (lower === '/reanudar-envios') return simple('resume_send');
  if (
    lower === '/finanzas' ||
    lower === 'resumen de finanzas' ||
    lower === 'como vienen mis finanzas' ||
    lower === 'como van mis finanzas' ||
    lower === 'cómo van mis finanzas' ||
    lower === 'cuanto junte' ||
    lower === 'cuanto junté' ||
    lower === 'cuánto junte' ||
    lower === 'cuánto junté' ||
    lower === 'cuanto tengo' ||
    lower === 'cuánto tengo'
  ) {
    return simple('finance_summary');
  }
  if (/\bfinanzas?\b/.test(lower) && /\b(como|c[oó]mo|van|vienen|quedan|quedaron|resumen|balance|tengo)\b/.test(lower)) {
    return simple('finance_summary');
  }

  const currency = parseCurrencyConversionV2(raw);
  if (currency) return currency;

  // /buscar-audios <texto>  (check before /buscar)
  let m = raw.match(/^\/buscar-audios\s+(.+)$/i);
  if (m) return { intent: 'search_audios', query: m[1]!.trim(), confidence: 1, raw };

  m = raw.match(/^\/buscar\s+(.+)$/i);
  if (m) return { intent: 'search', query: m[1]!.trim(), confidence: 1, raw };

  m = raw.match(/^\/chat\s+(.+)$/i);
  if (m) return { intent: 'chat_lookup', query: m[1]!.trim(), confidence: 1, raw };

  // /mandar-grupo <grupo>: <mensaje>
  m = raw.match(/^\/mandar-grupo\s+([^:]+):\s*([\s\S]+)$/i);
  if (m) {
    return {
      intent: 'send_group',
      targetType: 'group',
      target: m[1]!.trim(),
      message: m[2]!.trim(),
      confidence: 1,
      raw,
    };
  }

  // /mandar <contacto>: <mensaje>
  m = raw.match(/^\/mandar\s+([^:]+):\s*([\s\S]+)$/i);
  if (m) {
    return {
      intent: 'send_message',
      targetType: 'contact',
      target: m[1]!.trim(),
      message: m[2]!.trim(),
      confidence: 1,
      raw,
    };
  }

  // --- personal finances --------------------------------------------------
  const finance = parseFinanceFlexible(raw);
  if (finance) return finance;

  // --- tasks / reminders ---------------------------------------------------
  const task = parseTask(raw, now);
  if (task) return task;

  // --- natural language sends ---------------------------------------------
  const nl = parseNaturalLanguageSend(raw);
  if (nl) return nl;

  return { intent: 'unknown', confidence: 0, raw };
}

function parseTask(raw: string, now: Date): ParsedCommand | null {
  const normalized = raw.trim();
  const lower = normalized.toLowerCase();
  const prefix = lower.match(
    /^(?:\/tarea\s+|(?:como\s+)?pendiente\s*[:,]?\s*|(?:como\s+)?tarea\s*[:,]?\s*|recordame\s+|recu[eé]rdame\s+|anota(?:me)?\s+|anot[aá](?:me)?\s+|agreg(?:a|á|ar)(?:me|mos)?\s+|(?:poneme|pon[eé]|pone|dejame|dej[aá]|deja|sumame|sum[aá]|suma)\s+(?:como\s+)?(?:tarea|pendiente)\s*[:,]?\s*|(?:tengo|me queda|queda)\s+(?:como\s+)?pendiente\s*[:,]?\s*|(?:tengo|tenemos|hay)\s+que\s+|me\s+falta\s+|me\s+queda\s+)/i,
  );
  if (!prefix) return null;

  const body = normalized
    .slice(prefix[0].length)
    .replace(/^(?:(?:como\s+)?(?:tarea|pendiente)\s*[:,]?\s*)+/i, '')
    .replace(/^agreg(?:a|á|ar)(?:me|mos)?\s+/i, '')
    .trim();
  const items = splitTaskItems(body)
    .map((item) => parseTaskItem(item, now))
    .filter((item): item is NonNullable<ParsedCommand['task']> => !!item);
  if (items.length === 0) return null;

  return {
    intent: 'create_task',
    confidence: 0.98,
    raw,
    task: items[0],
    tasks: items.length > 1 ? items : undefined,
  };
}

function parseTaskItem(value: string, now: Date): NonNullable<ParsedCommand['task']> | null {
  const due = extractDueDate(value, now);
  const reminder = extractReminder(value, due);
  const recurrence = extractRecurrence(value);
  const title = value
    .replace(/\b(?:hoy|mañana|manana)\b/gi, '')
    .replace(/\b(?:en|a)\s+(?:\d+|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+d[ií]as?\b/gi, '')
    .replace(/\bel\s+\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/gi, '')
    .replace(/\ba\s+las?\s+\d{1,2}(?::\d{2})?(?:\s*hs?)?\b/gi, '')
    .replace(/\b\d{1,2}(?::\d{2})?\s*hs\b/gi, '')
    .replace(/\b(?:todos los dias|todas las semanas|todos los meses|cada dia|cada semana|cada mes)\b/gi, '')
    .replace(/[,;]?\s*(?:recordame|recu[eé]rdame|avisame|av[ií]same)\s+(?:\d+\s+|una?\s+)?(?:minutos?|horas?)?\s*antes\b/gi, '')
    .replace(/[,;]?\s+(?:y\s+)?(?:ya|nada\s+m[aá]s|listo)\s*[.!]?$/i, '')
    .replace(/\s+/g, ' ')
    .replace(/^[,;:\s]+|[,;:\s]+$/g, '')
    .trim();

  if (!title) return null;
  return {
    title: title.charAt(0).toUpperCase() + title.slice(1),
    dueAt: due?.toISOString() ?? null,
    remindAt: reminder?.toISOString() ?? null,
    priority: /\b(?:urgente|importante|prioridad alta)\b/i.test(value) ? 'high' : 'normal',
    recurrence,
  };
}

function splitTaskItems(body: string): string[] {
  return body
    .split(
      /(?:\r?\n|;|,\s*(?=(?:llevar|cambiar|subir|bajar|responder|contestar|contactar|enviar|mandar|revisar|verificar|llamar|comprar|pagar|buscar|hacer)\b))/i,
    )
    .map((item) => item.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);
}

function extractRecurrence(raw: string): 'daily' | 'weekly' | 'monthly' | null {
  if (/\b(?:todos los dias|cada dia)\b/i.test(raw)) return 'daily';
  if (/\b(?:todas las semanas|cada semana)\b/i.test(raw)) return 'weekly';
  if (/\b(?:todos los meses|cada mes)\b/i.test(raw)) return 'monthly';
  return null;
}

function parseFinanceFlexible(raw: string): ParsedCommand | null {
  const verbFirst = raw.match(/^(?:\/)?(gasto|gaste|gaste|pago|pague|ingreso|cobro|cobre|gane|deuda|debo)\b\s+(.+)$/i);
  const subjectFirst = raw.match(/^(.+?)\s+(pago|paga|cobro|cobra|debe|debia)\b\s+(.+)$/i);
  if (!verbFirst && !subjectFirst) return null;

  const verb = (verbFirst?.[1] ?? subjectFirst?.[2] ?? '').toLowerCase();
  const rest = verbFirst ? verbFirst[2]!.trim() : `${subjectFirst![1]!.trim()} ${subjectFirst![3]!.trim()}`;
  const components = extractFinanceAmounts(rest);
  if (components.length === 0) return null;

  const kind = /ingreso|cobr|gan/.test(verb) ? 'income' : /deuda|debo|debe|debia/.test(verb) ? 'debt' : 'expense';
  const fallback = kind === 'income' ? 'Ingreso' : kind === 'debt' ? 'Deuda' : 'Gasto';
  const description = cleanFinanceDescription(stripFinanceAmounts(rest)) || fallback;

  return {
    intent: 'finance_add',
    confidence: 0.98,
    raw,
    finance: {
      kind,
      amount: components[0]!.amount,
      currency: components.length === 1 ? components[0]!.currency : 'ARS',
      components,
      description: description.charAt(0).toUpperCase() + description.slice(1),
    },
  };
}

function extractFinanceAmounts(raw: string): { amount: number; currency: 'ARS' | 'USD' }[] {
  const amounts: { amount: number; currency: 'ARS' | 'USD' }[] = [];
  const pattern =
    /(?:(usd|u\$s|dolares|dolares|dolar|dolar)\s*)?(?:\$|ars\s*)?\s*([\d.,]+)\s*([km])?\s*(usd|u\$s|dolares|dolares|dolar|dolar)?/gi;

  for (const match of raw.matchAll(pattern)) {
    const full = match[0]?.trim() ?? '';
    if (!full || !/[0-9]/.test(full)) continue;
    const amount = parseMoneyAmount(match[2]!, match[3]?.toLowerCase() as 'k' | 'm' | undefined);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const currency = match[1] || match[4] ? 'USD' : 'ARS';
    amounts.push({ amount, currency });
  }

  return amounts;
}

function stripFinanceAmounts(raw: string): string {
  return raw
    .replace(
      /(?:(?:usd|u\$s|dolares|dolares|dolar|dolar)\s*)?(?:\$|ars\s*)?\s*[\d.,]+\s*[km]?\s*(?:usd|u\$s|dolares|dolares|dolar|dolar)?/gi,
      ' ',
    )
    .replace(/[+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[,;:\s]+|[,;:\s]+$/g, '');
}

function cleanFinanceDescription(raw: string): string {
  return raw
    .replace(/^(?:en|por|de)\s+/i, '')
    .replace(/\b(?:y|mas|con)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseMoneyAmount(value: string, suffix?: 'k' | 'm'): number {
  const normalized = suffix ? value.replace(',', '.') : value.replace(/\./g, '').replace(',', '.');
  const amount = Number(normalized);
  if (suffix === 'm') return amount * 1_000_000;
  if (suffix === 'k') return amount * 1_000;
  return amount;
}

function parseFinanceWithCurrency(raw: string): ParsedCommand | null {
  const match = raw.match(
    /^(?:\/)?(gasto|gaste|gasté|pague|pagué|ingreso|cobre|cobré|gane|gané|deuda|debo)\s+(?:\$|usd\s*)?\s*([\d.,]+)\s*(usd|u\$s|dolar|dolares|dólar|dólares)?\s*(?:en|por|de)?\s*(.*)$/i,
  );
  if (!match) return null;
  const verb = match[1]!.toLowerCase();
  const normalizedAmount = match[2]!.replace(/\./g, '').replace(',', '.');
  const amount = Number(normalizedAmount);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const kind = /ingreso|cobr|gan/.test(verb) ? 'income' : /deuda|debo/.test(verb) ? 'debt' : 'expense';
  const description = match[4]?.trim() || (kind === 'income' ? 'Ingreso' : kind === 'debt' ? 'Deuda' : 'Gasto');
  return {
    intent: 'finance_add',
    confidence: 0.98,
    raw,
    finance: {
      kind,
      amount,
      currency: match[3] ? 'USD' : 'ARS',
      description: description.charAt(0).toUpperCase() + description.slice(1),
    },
  };
}

function parseCurrencyConversion(raw: string): ParsedCommand | null {
  const match = raw.match(
    /^(?:(?:\/)?(?:dolar|dólar|blue|usd|cuanto|cuánto|cuantos|cuántos|pasame|converti|convertí)\s+)?(?:u\$s|usd|\$)?\s*([\d.,]+)\s*(?:usd|u\$s|dolar|dolares|dólar|dólares)\??$/i,
  );
  if (!match || !/(usd|u\$s|dolar|dólar|blue|cuanto|cuánto|convert|pasame)/i.test(raw)) return null;
  const amount = Number(match[1]!.replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return {
    intent: 'currency_convert',
    confidence: 0.99,
    raw,
    currency: { amount, from: 'USD', to: 'ARS' },
  };
}

function parseCurrencyConversionV2(raw: string): ParsedCommand | null {
  const normalized = raw
    .trim()
    .replace(/^(?:\/)?(?:cuanto|cuantos|cu[aÃ¡]nto|cu[aÃ¡]ntos)\s+(?:son|es)\s+/i, '')
    .replace(/^(?:\/)?(?:pasame|converti|convert[iÃ­]|dolar|d[oÃ³]lar|blue)\s+/i, '');
  const match = normalized.match(/^(?:u\$s|usd|\$)?\s*([\d.,]+)\s*(?:usd|u\$s|dolar|dolares|d[oÃ³]lar|d[oÃ³]lares)\??$/i);
  if (!match || !/(usd|u\$s|dolar|d[oÃ³]lar|blue|cuanto|cu[aÃ¡]nto|convert|pasame)/i.test(raw)) return null;
  const amount = Number(match[1]!.replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return {
    intent: 'currency_convert',
    confidence: 0.99,
    raw,
    currency: { amount, from: 'USD', to: 'ARS' },
  };
}

function parseFinance(raw: string): ParsedCommand | null {
  const match = raw.match(
    /^(?:\/)?(gasto|gast[eé]|pagu[eé]|ingreso|cobr[eé]|gan[eé]|deuda|debo)\s+\$?\s*([\d.,]+)\s*(?:en|por|de)?\s*(.*)$/i,
  );
  if (!match) return null;
  const verb = match[1]!.toLowerCase();
  const normalizedAmount = match[2]!.replace(/\./g, '').replace(',', '.');
  const amount = Number(normalizedAmount);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const kind = /ingreso|cobr|gan/.test(verb) ? 'income' : /deuda|debo/.test(verb) ? 'debt' : 'expense';
  const description = match[3]?.trim() || (kind === 'income' ? 'Ingreso' : kind === 'debt' ? 'Deuda' : 'Gasto');
  return {
    intent: 'finance_add',
    confidence: 0.98,
    raw,
    finance: {
      kind,
      amount,
      description: description.charAt(0).toUpperCase() + description.slice(1),
    },
  };
}

function extractDueDate(raw: string, now: Date): Date | null {
  const lower = raw.toLowerCase();
  let date: Date | null = null;

  const relativeDays = lower.match(
    /\b(?:en|a)\s+(\d+|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+d[ií]as?\b/i,
  );
  if (relativeDays) {
    date = new Date(now);
    date.setDate(date.getDate() + parseSpanishCount(relativeDays[1]!));
  } else if (/\bmañana\b|\bmanana\b/.test(lower)) {
    date = new Date(now);
    date.setDate(date.getDate() + 1);
  } else if (/\bhoy\b/.test(lower)) {
    date = new Date(now);
  } else {
    const match = raw.match(/\bel\s+(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/i);
    if (match) {
      let year = match[3] ? Number(match[3]) : now.getFullYear();
      if (year < 100) year += 2000;
      date = new Date(year, Number(match[2]) - 1, Number(match[1]));
    }
  }

  const time = raw.match(/\ba\s+las?\s+(\d{1,2})(?::(\d{2}))?(?:\s*hs?)?\b/i)
    ?? raw.match(/\b(\d{1,2})(?::(\d{2}))?\s*hs\b/i);
  if (!date && time) date = new Date(now);
  if (!date) return null;

  if (time) {
    date.setHours(Number(time[1]), Number(time[2] ?? 0), 0, 0);
  } else {
    date.setHours(18, 0, 0, 0);
  }
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseSpanishCount(value: string): number {
  if (/^\d+$/.test(value)) return Number(value);
  return {
    un: 1,
    una: 1,
    dos: 2,
    tres: 3,
    cuatro: 4,
    cinco: 5,
    seis: 6,
    siete: 7,
    ocho: 8,
    nueve: 9,
    diez: 10,
  }[value.toLowerCase()] ?? 0;
}

function extractReminder(raw: string, due: Date | null): Date | null {
  if (!due) return null;
  const before = raw.match(
    /(?:recordame|recu[eé]rdame|avisame|av[ií]same)\s+(?:(\d+)|una?)\s*(minutos?|horas?)\s+antes/i,
  );
  if (!before) {
    return /^(?:recordame|recu[eé]rdame)/i.test(raw.trim()) ? new Date(due) : null;
  }

  const amount = Number(before[1] ?? 1);
  const millis = /^hora/i.test(before[2]!) ? amount * 60 * 60 * 1000 : amount * 60 * 1000;
  return new Date(due.getTime() - millis);
}

const SEND_VERBS = ['mandale', 'mandá', 'manda', 'avisale', 'avisá', 'avisa', 'decile', 'decí', 'deci', 'escribile', 'escribi'];

function parseNaturalLanguageSend(raw: string): ParsedCommand | null {
  const lower = raw.toLowerCase();
  const verb = SEND_VERBS.find((v) => lower.startsWith(v));
  if (!verb) return null;

  // Strip leading verb.
  const rest = raw.slice(verb.length).trim();

  // Find the connector "que" that separates target from message.
  const queMatch = rest.match(/\bque\b/i);
  if (!queMatch || queMatch.index === undefined) return null;

  let targetPart = rest.slice(0, queMatch.index).trim();
  let message = rest.slice(queMatch.index + queMatch[0].length).trim();

  // Clean target prefixes: "a", "al", "al grupo", "le", etc.
  const groupFlag = /grupo/i.test(targetPart);
  targetPart = targetPart
    .replace(/^a\s+/i, '')
    .replace(/^al\s+/i, '')
    .replace(/^grupo\s+/i, '')
    .replace(/\bgrupo\b/gi, '')
    .trim();

  if (!targetPart || !message) return null;

  // Convert third-person promise into a first-person message where obvious.
  message = humanizeMessage(message);

  // Confidence: shorter, cleaner targets are more reliable.
  const wordCount = targetPart.split(/\s+/).length;
  const confidence = wordCount <= 4 ? 0.92 : 0.78;

  return {
    intent: groupFlag ? 'send_group' : 'send_message',
    targetType: groupFlag ? 'group' : 'contact',
    target: targetPart,
    message,
    confidence,
    raw,
  };
}

function humanizeMessage(msg: string): string {
  let out = msg.trim();
  // "mañana le paso las fotos" -> "Mañana te paso las fotos."
  out = out.replace(/\ble\s+/i, 'te ');
  out = out.charAt(0).toUpperCase() + out.slice(1);
  if (!/[.!?]$/.test(out)) out += '.';
  return out;
}
