import { describe, expect, test } from 'vitest';
import { codeTiles, normaliseCode } from './codeTiles';

describe('normaliseCode', () => {
  test('is not case sensitive: letters come out as capitals', () => {
    expect(normaliseCode('k7q2xm', 6)).toBe('K7Q2XM');
  });

  test('keeps letters and digits only (a pasted code with spaces or a dash)', () => {
    expect(normaliseCode(' K7Q-2XM ', 6)).toBe('K7Q2XM');
    expect(normaliseCode('k7 q2 ✓', 6)).toBe('K7Q2');
  });

  test('stops at the length', () => {
    expect(normaliseCode('K7Q2XMZZ', 6)).toBe('K7Q2XM');
    expect(normaliseCode('1234', 3)).toBe('123');
  });
});

describe('codeTiles', () => {
  test('filled tiles, then the current one with the caret, then empty ones', () => {
    expect(codeTiles('K7', 4, false)).toEqual([
      { char: 'K', state: 'filled', caret: false },
      { char: '7', state: 'filled', caret: false },
      { char: '', state: 'current', caret: true },
      { char: '', state: 'empty', caret: false },
    ]);
  });

  test('a full code has no current tile and no caret', () => {
    expect(codeTiles('K7Q2', 4, false).map((t) => [t.state, t.caret])).toEqual([
      ['filled', false],
      ['filled', false],
      ['filled', false],
      ['filled', false],
    ]);
  });

  test('a refused code rings every tile, and the caret still shows where typing goes on', () => {
    const tiles = codeTiles('K7Q', 4, true);
    expect(tiles.map((t) => t.state)).toEqual(['error', 'error', 'error', 'error']);
    expect(tiles.map((t) => t.caret)).toEqual([false, false, false, true]);
  });

  test('an empty code starts at the first tile', () => {
    expect(codeTiles('', 6, false)[0]).toEqual({ char: '', state: 'current', caret: true });
  });
});
