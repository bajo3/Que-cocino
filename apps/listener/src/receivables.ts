export type ReceivableComponent = { amount: number; currency: 'ARS' | 'USD' };

export type ReceivableDraft = {
  description: string;
  components: ReceivableComponent[];
};

export function parseReceivablesList(text: string): ReceivableDraft[] | null {
  if (!/\b(?:trabajos?|cosas?|laburos?)\b[\s\S]{0,80}\b(?:pendientes?\s+)?(?:para|por)\s+cobrar\b/i.test(text)) {
    return null;
  }

  const items = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map(parseReceivableLine)
    .filter((item): item is ReceivableDraft => item !== null);

  return items.length > 0 ? items : null;
}

function parseReceivableLine(line: string): ReceivableDraft | null {
  const match = line.match(/^(?:[-*•]|\d+[.)])?\s*(.+?)\s*=\s*(.+)$/);
  if (!match) return null;

  const description = match[1]!.replace(/\s+/g, ' ').trim();
  const components = extractReceivableAmounts(match[2]!);
  if (!description || components.length === 0) return null;
  return { description, components };
}

export function extractReceivableAmounts(text: string): ReceivableComponent[] {
  const components: ReceivableComponent[] = [];
  const pattern =
    /(?:(usd|u\$s|dolares|dólares|dolar|dólar)\s*)?(?:\$|ars\s*)?\s*([\d.,]+)\s*([km])?\s*(usd|u\$s|dolares|dólares|dolar|dólar)?/gi;

  for (const match of text.matchAll(pattern)) {
    const amount = parseMoneyAmount(match[2]!, match[3]?.toLowerCase() as 'k' | 'm' | undefined);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    components.push({
      amount,
      currency: match[1] || match[4] ? 'USD' : 'ARS',
    });
  }
  return components;
}

export function parseReceivableAppend(text: string): { index: number; detail: string } | null {
  const match = text.match(
    /\b(?:al\s+)?(?:n[uú]mero\s*)?(\d+)\b[\s\S]*?\b(?:sumale|sumále|agregale|agregále|añadile|ponele|ponéle)\s+(.+)$/i,
  );
  if (!match) return null;

  const index = Number(match[1]);
  const detail = match[2]!
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!Number.isInteger(index) || index < 1 || !detail) return null;
  return { index, detail };
}

export function isReceivablesQuery(text: string): boolean {
  const normalized = normalizeQuery(text);

  return (
    /^(?:mis\s+)?cobros(?:\s+pendientes)?$/.test(normalized) ||
    /^(?:que|como)\s+(?:cobros|trabajos)\s+(?:tengo\s+)?pendientes$/.test(normalized)
  );
}

export function isReceivablesFollowUpQuery(text: string): boolean {
  const normalized = normalizeQuery(text);
  return /^(?:como|que)\s+quedo\s+(?:todo|la\s+lista)$/.test(normalized);
}

export function isReceivablesSaveConfirmation(text: string): boolean {
  const normalized = normalizeQuery(text);
  return /^(?:si\s+)?(?:cargalo|cargala|anotalo|anotala|guardalo|guardala|dejalo|dejala)(?:\s+como)?\s+(?:un\s+)?pendiente(?:\s+de|\s+para)?\s+cobrar$/.test(
    normalized,
  );
}

export function parseReceivablesClientName(text: string): string | null {
  const value = text
    .trim()
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ');
  if (!value || value.length > 80) return null;
  const words = value.split(' ');
  if (words.length < 1 || words.length > 5) return null;
  if (!words.every((word) => /^[\p{L}'-]+$/u.test(word))) return null;
  if (/^(?:si|no|dale|listo|gracias|perfecto|ok|bueno|hola|buenas)$/i.test(value)) return null;
  return words
    .map((word) => word.charAt(0).toLocaleUpperCase('es-AR') + word.slice(1).toLocaleLowerCase('es-AR'))
    .join(' ');
}

function normalizeQuery(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿?!.]+$/g, '')
    .trim();
}

function parseMoneyAmount(value: string, suffix?: 'k' | 'm'): number {
  const normalized = suffix ? value.replace(',', '.') : value.replace(/\./g, '').replace(',', '.');
  const amount = Number(normalized);
  if (suffix === 'm') return amount * 1_000_000;
  if (suffix === 'k') return amount * 1_000;
  return amount;
}
