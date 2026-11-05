// The one-time code under CodeTiles (Link to your account: six letters and numbers, not case sensitive). Pure.

/** What a tile shows: its character, and how it's ringed. */
export type CodeTile = {
  char: string;
  /** error: every tile when the code was refused. current: where the next character goes. filled / empty. */
  state: 'error' | 'current' | 'filled' | 'empty';
  /** The caret blinks in the current tile until the code is full. */
  caret: boolean;
};

/** Typed, pasted or autofilled text as a code: capitals and digits only, at most `length`. */
export function normaliseCode(raw: string, length: number): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, length);
}

/** The tiles for a (normalised) code. */
export function codeTiles(code: string, length: number, error: boolean): CodeTile[] {
  return Array.from({ length }, (_, i) => ({
    char: code[i] ?? '',
    state: error ? 'error' : i === code.length ? 'current' : i < code.length ? 'filled' : 'empty',
    caret: i === code.length && code.length < length,
  }));
}
