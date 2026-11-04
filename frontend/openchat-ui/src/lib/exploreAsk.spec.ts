import { describe, expect, test } from 'vitest';
import { askedFor } from './exploreAsk';

const ask = { text: 'rust', languages: ['en', 'fr'], sort: 0, offset: 0 };

describe('askedFor', () => {
  test('the search shown was asked for: the same text, sort and languages in any order, any page', () => {
    expect(askedFor(ask, { text: 'rust', languages: ['fr', 'en'], sort: 0 })).toBe(true);
    expect(askedFor({ ...ask, offset: 6 }, { text: 'rust', languages: ['en', 'fr'], sort: 0 })).toBe(true);
  });

  test('a language picked or dropped since is another search, so an error for the last one no longer shows', () => {
    expect(askedFor(ask, { text: 'rust', languages: ['en'], sort: 0 })).toBe(false);
    expect(askedFor(ask, { text: 'rust', languages: ['en', 'fr', 'ja'], sort: 0 })).toBe(false);
    expect(askedFor(ask, { text: 'rust', languages: ['en', 'en'], sort: 0 })).toBe(false);
  });

  test('another text or sort is another search', () => {
    expect(askedFor(ask, { text: 'rus', languages: ['en', 'fr'], sort: 0 })).toBe(false);
    expect(askedFor(ask, { text: 'rust', languages: ['en', 'fr'], sort: 1 })).toBe(false);
  });

  test('nothing asked yet', () => {
    expect(askedFor(null, { text: '', languages: [], sort: 0 })).toBe(false);
  });
});
