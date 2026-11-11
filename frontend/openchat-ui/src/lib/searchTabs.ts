// The chat list's search tabs (web plan 04, "Search"): All / Chats / People, each with a badge of its results, and
// what each tab lists. All caps its sections, each ending in "+N more …" that switches to that section's tab; Chats
// and People list everything found. Messages, the plan's fourth tab, isn't built (the app's GAPS.md, "Chat list").

/** A search tab, in the order the tabs show. */
export type SearchTab = 'all' | 'chats' | 'people';

/** The tabs, in order: their index is the tab bar's. */
export const SEARCH_TABS: readonly SearchTab[] = ['all', 'chats', 'people'];

/** How many of each All shows before its "+N more …" (web/04: 5 chats, 3 people). */
export const ALL_TAB_CAPS = { chats: 5, people: 3 } as const;

/** What a search found: the chats that match, in the list's order, and the people (and bots) found. */
export type SearchFound<T> = { chats: readonly T[]; people: readonly T[] };

/** A section of a tab's results: its rows, how many there are in all, and how many more its own tab has. */
export type SearchSection<T> = {
  /** The tab the section's results belong to; "+N more …" switches to it. */
  tab: Exclude<SearchTab, 'all'>;
  rows: T[];
  total: number;
  /** The results the section leaves out (All's caps): its "+N more …"; 0 for none. */
  more: number;
  /** All's sections have headings (label + total); a tab of its own needs none. */
  labelled: boolean;
};

/**
 * Each tab's badge: how many results it has. All's is every result, the other tabs' badges added up (not the rows its
 * caps leave showing), so it reads as the search's total and "+N more …" adds up to it.
 */
export function searchTabCounts<T>(found: SearchFound<T>): Record<SearchTab, number> {
  const chats = found.chats.length;
  const people = found.people.length;
  return { all: chats + people, chats, people };
}

/** The badges in the tabs' order (SEARCH_TABS). */
export function searchTabBadges<T>(found: SearchFound<T>): number[] {
  const counts = searchTabCounts(found);
  return SEARCH_TABS.map((tab) => counts[tab]);
}

/**
 * What a tab lists. All: a Chats section (its first 5) and a People section (its first 3), an empty one left out.
 * Chats or People: every result of its kind, unheaded.
 */
export function searchSections<T>(tab: SearchTab, found: SearchFound<T>): SearchSection<T>[] {
  if (tab !== 'all') {
    const rows = [...found[tab]];
    return rows.length === 0 ? [] : [{ tab, rows, total: rows.length, more: 0, labelled: false }];
  }
  return (['chats', 'people'] as const).flatMap((kind): SearchSection<T>[] => {
    const all = found[kind];
    const rows = all.slice(0, ALL_TAB_CAPS[kind]);
    return all.length === 0 ? [] : [{ tab: kind, rows, total: all.length, more: all.length - rows.length, labelled: true }];
  });
}
