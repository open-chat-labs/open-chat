import { describe, expect, test } from 'vitest';
import { ALL_TAB_CAPS, SEARCH_TABS, searchSections, searchTabBadges, searchTabCounts } from './searchTabs';

const range = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);
const none: string[] = [];

describe('the search tabs', () => {
  test('are All, Chats, People and Groups, in that order', () => {
    expect(SEARCH_TABS).toEqual(['all', 'chats', 'people', 'groups']);
  });

  test("badge their results, All's being every result", () => {
    const found = { chats: range('c', 7), people: range('p', 4), groups: range('g', 2) };
    expect(searchTabCounts(found)).toEqual({ all: 13, chats: 7, people: 4, groups: 2 });
    expect(searchTabBadges(found)).toEqual([13, 7, 4, 2]);
    expect(searchTabBadges({ chats: none, people: none, groups: none })).toEqual([0, 0, 0, 0]);
  });
});

describe("All's sections", () => {
  test('are up to 5 chats, 3 people and 3 groups, each with how many more its own tab has', () => {
    expect(ALL_TAB_CAPS).toEqual({ chats: 5, people: 3, groups: 3 });
    expect(searchSections('all', { chats: range('c', 7), people: range('p', 4), groups: range('g', 6) })).toEqual([
      { tab: 'chats', rows: range('c', 5), total: 7, more: 2, labelled: true },
      { tab: 'people', rows: range('p', 3), total: 4, more: 1, labelled: true },
      { tab: 'groups', rows: range('g', 3), total: 6, more: 3, labelled: true },
    ]);
  });

  test('have nothing more when everything fits', () => {
    expect(searchSections('all', { chats: range('c', 5), people: range('p', 2), groups: range('g', 3) }).map((s) => s.more)).toEqual([
      0, 0, 0,
    ]);
  });

  test('leave an empty one out', () => {
    expect(searchSections('all', { chats: none, people: range('p', 1), groups: none })).toEqual([
      { tab: 'people', rows: ['p1'], total: 1, more: 0, labelled: true },
    ]);
    expect(searchSections('all', { chats: none, people: none, groups: range('g', 1) })).toEqual([
      { tab: 'groups', rows: ['g1'], total: 1, more: 0, labelled: true },
    ]);
    expect(searchSections('all', { chats: none, people: none, groups: none })).toEqual([]);
  });
});

describe('Chats, People and Groups', () => {
  const found = { chats: range('c', 9), people: range('p', 6), groups: range('g', 4) };

  test('list every result of their kind, unheaded', () => {
    expect(searchSections('chats', found)).toEqual([{ tab: 'chats', rows: range('c', 9), total: 9, more: 0, labelled: false }]);
    expect(searchSections('people', found)).toEqual([{ tab: 'people', rows: range('p', 6), total: 6, more: 0, labelled: false }]);
    expect(searchSections('groups', found)).toEqual([{ tab: 'groups', rows: range('g', 4), total: 4, more: 0, labelled: false }]);
  });

  test('list nothing when nothing of their kind was found', () => {
    expect(searchSections('people', { chats: ['c1'], people: none, groups: ['g1'] })).toEqual([]);
    expect(searchSections('groups', { chats: ['c1'], people: ['p1'], groups: none })).toEqual([]);
  });
});
