// Amount inputs accept "." or "," as the decimal mark whatever the locale ("1,5" and "1.5" are both 1.5), so a
// comma-decimal user never sends 10x what they typed. Grouping is only recognised in a pasted "1,234.56" or "1.234,56"
// (both marks, 3-digit groups): the last mark is the decimal one.

/** Digits plus at most one decimal mark, as typed. Use in an amount input's oninput. */
export function cleanAmount(text: string): string {
  const raw = text.replace(/[^0-9.,]/g, '');
  const last = Math.max(raw.lastIndexOf('.'), raw.lastIndexOf(','));
  // both marks with 3-digit groups ("1,234.56"): the earlier ones are grouping; otherwise the first mark typed wins
  const grouped = raw.includes('.') && raw.includes(',') && /^\d{1,3}([.,]\d{3})*[.,]\d*$/.test(raw) && raw[last] !== raw[raw.search(/[.,]/)];
  const decimalAt = grouped ? last : raw.search(/[.,]/);
  let out = '';
  for (let i = 0; i < raw.length; i++) if (!/[.,]/.test(raw[i]) || i === decimalAt) out += raw[i];
  return out;
}

/** The number an amount input holds; 0 when empty or incomplete. */
export function parseAmount(text: string): number {
  const n = Number(cleanAmount(text).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}
