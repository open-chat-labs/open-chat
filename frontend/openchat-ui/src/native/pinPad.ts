// The PIN pad's rules (PinPad.svelte): what a key does to the digits so far, and the dots.

/** A key on the pad: a digit, or delete. */
export type PinKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'delete';

/** The pad's keys in order, row by row; null is the empty place left of 0. */
export const PIN_KEYS: (PinKey | null)[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', null, '0', 'delete'];

/** The digits after a key: a digit is added until there are `length`, delete takes the last one off. */
export function pinPress(value: string, key: PinKey, length: number): string {
  if (key === 'delete') return value.slice(0, -1);
  return value.length >= length ? value : value + key;
}

/** The key a keyboard key stands for (a digit, Backspace or Delete), if any. */
export function pinKeyOf(key: string): PinKey | undefined {
  if (/^[0-9]$/.test(key)) return key as PinKey;
  return key === 'Backspace' || key === 'Delete' ? 'delete' : undefined;
}

/** One dot per digit of the PIN, filled as far as it's been typed. */
export function pinDots(value: string, length: number): boolean[] {
  return Array.from({ length }, (_, i) => i < value.length);
}
