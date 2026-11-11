import { describe, expect, test } from 'vitest';
import { ALL_TAB_CAPS, SEARCH_TABS, searchSections, searchTabBadges, searchTabCounts } from './searchTabs';

const range = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);

describe('the search tabs', () => {
  test('are All, Chats and People, in that order', () => {
    expect(SEARCH_TABS).toEqual(['all', 'chats', 'people']);
  });

  test("badge their results, All's being every result", () => {
    const found = { chats: range('c', 7), people: range('p', 4) };
    expect(searchTabCounts(found)).toEqual({ all: 11, chats: 7, people: 4 });
    expect(searchTabBadges(found)).toEqual([11, 7, 4]);
    expect(searchTabBadges({ chats: [], people: [] })).toEqual([0, 0, 0]);
  });
});

describe("All's sections", () => {
  test('are up to 5 chats and 3 people, each with how many more its own tab has', () => {
    expect(ALL_TAB_CAPS).toEqual({ chats: 5, people: 3 });
    expect(searchSections('all', { chats: range('c', 7), people: range('p', 4) })).toEqual([
      { tab: 'chats', rows: range('c', 5), total: 7, more: 2, labelled: true },
      { tab: 'people', rows: range('p', 3), total: 4, more: 1, labelled: true },
    ]);
  });

  test('have nothing more when everything fits', () => {
    expect(searchSections('all', { chats: range('c', 5), people: range('p', 2) }).map((s) => s.more)).toEqual([0, 0]);
  });

  test('leave an empty one out', () => {
    expect(searchSections('all', { chats: [], people: range('p', 1) })).toEqual([
      { tab: 'people', rows: ['p1'], total: 1, more: 0, labelled: true },
    ]);
    expect(searchSections('all', { chats: [], people: [] })).toEqual([]);
  });
});

describe('Chats and People', () => {
  const found = { chats: range('c', 9), people: range('p', 6) };

  test('list every result of their kind, unheaded', () => {
    expect(searchSections('chats', found)).toEqual([{ tab: 'chats', rows: range('c', 9), total: 9, more: 0, labelled: false }]);
    expect(searchSections('people', found)).toEqual([{ tab: 'people', rows: range('p', 6), total: 6, more: 0, labelled: false }]);
  });

  test('list nothing when nothing of their kind was found', () => {
    expect(searchSections('people', { chats: ['c1'], people: [] })).toEqual([]);
  });
});
