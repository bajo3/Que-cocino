import type { MessageClass, Priority } from '@wma/shared';
import type { MessageClassification, DetectedTask } from '@wma/shared';
import { HOT_LEAD_CLASSES } from '@wma/shared';

/** Lowercase + strip accents for robust keyword matching. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

interface Rule {
  cls: MessageClass;
  priority: Priority;
  patterns: RegExp[];
}

// Order matters: first matching rule wins.
const RULES: Rule[] = [
  {
    cls: 'venta_cerrada',
    priority: 'high',
    patterns: [/\bvendido\b/, /\bcerramos\b/, /\bme lo llevo\b/, /\bse vendio\b/, /\bquedamos\b.*\bcomprar/],
  },
  {
    cls: 'reclamo',
    priority: 'urgent',
    patterns: [/\breclamo\b/, /\bqueja\b/, /\bestafa\b/, /\bpesimo\b/, /\bno funciona\b/, /\bme mintieron\b/, /\benojado\b/],
  },
  {
    cls: 'consulta_financiacion',
    priority: 'high',
    patterns: [/financia/, /\bcuotas\b/, /\bcredito\b/, /\bprenda\b/, /\banticipo\b/, /\bplan\b/],
  },
  {
    cls: 'consulta_permuta',
    priority: 'high',
    patterns: [/permut/, /\bentrego\b.*\busado\b/, /\btomas\b.*\busado\b/, /\bparte de pago\b/, /entrega.*usado/],
  },
  {
    cls: 'consulta_entrega',
    priority: 'high',
    patterns: [/\bentrega inmediata\b/, /\bcuando.*entrega/, /\bplazo de entrega\b/, /\bya disponible\b/],
  },
  {
    cls: 'consulta_precio',
    priority: 'high',
    patterns: [/\bprecio\b/, /\bcuanto.*sale\b/, /\bcuanto.*cuesta\b/, /\bvalor\b/, /\bcuanto vale\b/, /\bcotiza/],
  },
  {
    cls: 'documentacion',
    priority: 'normal',
    patterns: [/\bdocumenta/, /\btransferenci(a|as) de.*titulo/, /\bpapeles\b/, /\bdni\b/, /\bformulario\b/, /\btitulo\b/],
  },
  {
    cls: 'grupo_interno',
    priority: 'low',
    patterns: [/\bequipo\b/, /\binterno\b/, /\bvendedores\b/],
  },
];

/** Phrases that strongly indicate a "hot" buyer regardless of class. */
const HOT_SIGNALS = [
  /\breserva(me)?\b/,
  /\bte transfiero\b/,
  /\bpaso manana\b/,
  /\bpaso hoy\b/,
  /\bme lo guardas\b/,
  /\bsena\b/,
  /\bseña\b/,
  /\bmanda.*fotos\b/,
  /\bpasame.*fotos\b/,
  /\bquiero comprar\b/,
];

export function classifyHeuristic(textRaw: string, fromMe = false): MessageClassification {
  const text = normalize(textRaw ?? '');
  if (!text.trim()) {
    return { class: 'ruido', priority: 'low', isHotLead: false, reason: 'empty' };
  }

  let matched: Rule | undefined;
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(text))) {
      matched = rule;
      break;
    }
  }

  const hot = HOT_SIGNALS.some((p) => p.test(text));
  let cls: MessageClass = matched?.cls ?? 'ruido';
  let priority: Priority = matched?.priority ?? 'low';

  if (hot && !fromMe) {
    cls = HOT_LEAD_CLASSES.includes(cls) ? cls : 'cliente_caliente';
    priority = 'urgent';
  }

  const isHotLead = !fromMe && (hot || HOT_LEAD_CLASSES.includes(cls));
  if (isHotLead && cls === 'ruido') cls = 'cliente_caliente';

  return {
    class: cls,
    priority,
    isHotLead,
    reason: matched ? `matched ${matched.cls}` : hot ? 'hot signal' : 'no rule',
  };
}

// Promise / task detection ---------------------------------------------------

const PROMISE_PATTERNS: { re: RegExp; title: (m: RegExpMatchArray) => string }[] = [
  {
    re: /\b(?:acordate|acordarte|recordame|recuerdame)\s+(?:de\s+)?(.+)/,
    title: (m) => capitalizeTask((m[1] ?? '').replace(/\s+(?:primo|amigo|bro|porfa|por favor)$/i, '')),
  },
  { re: /\bmanana le (paso|mando|envio|confirmo)\b([^.]*)/, title: (m) => `Mañana ${m[1]}${m[2] ?? ''}`.trim() },
  { re: /\bte (paso|mando|envio) (las |el |los )?(fotos|foto|info|precio|documentacion)\b/, title: (m) => `Pasar ${m[3]}` },
  { re: /\b(maniana|manana) (te|le) (confirmo|aviso|respondo)\b/, title: () => 'Confirmar mañana' },
  { re: /\bdespues (te|le) (paso|mando|aviso|confirmo)\b/, title: () => 'Responder pendiente' },
  { re: /\bqued(o|amos) en (que )?(.+)/, title: (m) => `Quedó en: ${m[3]}` },
];

export function detectTasksHeuristic(textRaw: string, fromMe = false): DetectedTask[] {
  const text = normalize(textRaw ?? '');
  if (!text.trim()) return [];
  const tasks: DetectedTask[] = [];

  for (const { re, title } of PROMISE_PATTERNS) {
    const m = text.match(re);
    if (m) {
      tasks.push({
        title: title(m).slice(0, 120),
        description: fromMe ? 'Compromiso propio detectado' : 'Pendiente con el contacto',
        priority: fromMe ? 'high' : 'normal',
        dueAt: /\bmanana\b|\bmaniana\b/.test(text) ? isoTomorrow() : null,
      });
    }
  }
  return dedupeTasks(tasks);
}

function capitalizeTask(value: string): string {
  const clean = value.trim();
  return clean ? clean[0]!.toUpperCase() + clean.slice(1) : clean;
}

function dedupeTasks(tasks: DetectedTask[]): DetectedTask[] {
  const seen = new Set<string>();
  return tasks.filter((t) => {
    const k = t.title.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function isoTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}
