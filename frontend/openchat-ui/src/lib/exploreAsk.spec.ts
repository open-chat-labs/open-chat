import { describe, expect, test } from 'vitest';
import { askTiming, askedFor, homeRefresh, sameLanguages, searchViewShown } from './exploreAsk';

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

describe('sameLanguages', () => {
  test('the same languages in any order, duplicates not counted twice', () => {
    expect(sameLanguages(['en', 'fr'], ['fr', 'en'])).toBe(true);
    expect(sameLanguages([], [])).toBe(true);
    expect(sameLanguages(['en'], ['en', 'fr'])).toBe(false);
    expect(sameLanguages(['en', 'en'], ['en', 'fr'])).toBe(false);
  });
});

describe('askTiming', () => {
  const asked = { text: 'rust', languages: ['en'], sort: 0, offset: 0 };

  test('a sort or a language change is asked at once', () => {
    expect(askTiming(asked, { text: 'rust', languages: ['en'], sort: 2 })).toBe('now');
    expect(askTiming(asked, { text: 'rust', languages: ['en', 'fr'], sort: 0 })).toBe('now');
  });

  test('a change of text waits for typing to pause, but an emptied text (leaving the search) is asked at once', () => {
    expect(askTiming(asked, { text: 'rus', languages: ['en'], sort: 0 })).toBe('debounced');
    expect(askTiming(asked, { text: '', languages: ['en'], sort: 0 })).toBe('now');
  });

  test('the search already asked for is not asked again', () => {
    expect(askTiming(asked, { text: 'rust', languages: ['en'], sort: 0 })).toBe('none');
    expect(askTiming({ ...asked, offset: 6 }, { text: 'rust', languages: ['en'], sort: 0 })).toBe('none');
  });
});

describe('searchViewShown', () => {
  test('shows while there is text', () => {
    expect(searchViewShown('rust', false)).toBe(true);
    expect(searchViewShown('  ', false)).toBe(false);
  });

  test('once the user opened it, it stays open emptied, until they leave it', () => {
    expect(searchViewShown('', true)).toBe(true);
    expect(searchViewShown('', false)).toBe(false);
  });
});

describe('homeRefresh', () => {
  const page = { text: '', languages: ['en'], sort: 0 };

  test('a new sort refreshes only the list, in place: the hero and Popular stay as they are', () => {
    expect(homeRefresh(page, { ...page, sort: 1 }, true)).toEqual({ list: 'refreshing', top: false });
  });

  test('other languages refresh the list in place, and the hero and Popular wait', () => {
    expect(homeRefresh(page, { ...page, languages: ['fr'] }, true)).toEqual({ list: 'refreshing', top: true });
  });

  test("a page left from a search is never shown as the home list: it all waits", () => {
    expect(homeRefresh({ ...page, text: 'rust' }, page, true)).toEqual({ list: 'loading', top: true });
  });

  test('nothing waits once the host has answered', () => {
    expect(homeRefresh(page, { ...page, languages: ['fr'] }, false)).toEqual({ list: 'ready', top: false });
  });
});
