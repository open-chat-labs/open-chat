import { describe, expect, test } from 'vitest';
import { asksForGifs } from './gifAsk';

describe('asksForGifs', () => {
  test('a search not asked for yet is asked for', () => {
    expect(asksForGifs('', undefined, undefined)).toBe(true);
    expect(asksForGifs('cats', '', 'idle')).toBe(true);
    expect(asksForGifs('', 'cats', 'failed')).toBe(true);
  });

  test('the search last asked for is not asked again while it loads or once it has', () => {
    expect(asksForGifs('cats', 'cats', 'loading')).toBe(false);
    expect(asksForGifs('cats', 'cats', 'idle')).toBe(false);
    expect(asksForGifs('', '', 'idle')).toBe(false);
  });

  test('the search last asked for is asked again when its load failed, to retry it', () => {
    expect(asksForGifs('', '', 'failed')).toBe(true);
    expect(asksForGifs('reactions', 'reactions', 'failed')).toBe(true);
  });
});
