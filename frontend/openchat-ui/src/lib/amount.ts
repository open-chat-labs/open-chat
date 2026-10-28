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

// Amounts are cut and compared in whole units of the token's last decimal, read from the number's shortest decimal
// form (what String(x) prints). Multiplying by 10^dp instead adds float noise (0.000251 * 1e6 is 250.99999999999997)
// and, past 15-17 significant digits (18-decimal tokens, large balances), can round up past the balance.

/** x as plain decimal digits: String(x) without an exponent ("1e-8" → "0.00000001"). */
export function plain(x: number): string {
  const m = String(x).match(/^(\d+)(?:\.(\d+))?e([+-]\d+)$/);
  if (!m) return String(x);
  const digits = m[1] + (m[2] ?? '');
  const point = m[1].length + Number(m[3]);
  if (point <= 0) return `0.${'0'.repeat(-point)}${digits}`;
  if (point >= digits.length) return digits + '0'.repeat(point - digits.length);
  return `${digits.slice(0, point)}.${digits.slice(point)}`;
}

/** x in whole units of 10^-dp, rounded down; 0 for anything not above 0. */
export function toUnits(x: number, dp: number): bigint {
  if (!(x > 0) || !Number.isFinite(x)) return 0n;
  const [whole, frac = ''] = plain(x).split('.');
  return BigInt(whole + frac.slice(0, dp).padEnd(dp, '0'));
}

function unitsText(units: bigint, dp: number): string {
  const s = units.toString().padStart(dp + 1, '0');
  return dp > 0 ? `${s.slice(0, -dp)}.${s.slice(-dp)}` : s;
}

/** The largest double below a positive x. */
function below(x: number): number {
  const bits = new BigInt64Array(new Float64Array([x]).buffer);
  bits[0] -= 1n;
  return new Float64Array(bits.buffer)[0];
}

/** A count of 10^-dp units as a number, never more than that many units: past 17 significant digits the nearest
 *  double can be above the decimal, so it steps down to the one below. */
export function fromUnits(units: bigint, dp: number): number {
  let x = Number(unitsText(units, dp));
  while (x > 0 && toUnits(x, dp) > units) x = below(x);
  return x;
}

/** x rounded down to dp decimals; never more than x, so a share of a balance never exceeds it. */
export function floorTo(x: number, dp: number): number {
  return fromUnits(toUnits(x, dp), dp);
}

/** x as amount-input text: rounded down to dp decimals, no exponent ("0.00000001", not "1e-8"), no trailing zeros. */
export function amountText(x: number, dp: number): string {
  const s = unitsText(toUnits(x, dp), dp);
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

/** A USD figure for an amount input, rounded down to cents so it never reads back as more than the amount. */
export function usdText(x: number): string {
  return floorTo(x, 2).toFixed(2);
}
