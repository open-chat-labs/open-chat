// What ExploreCommunities last asked its host for (onQuery mode), and whether that's the search it shows now: until the
// host has answered the search as it stands, the page held belongs to another one, and mustn't pass as its answer.

/** The search as the component shows it: the text (trimmed), the languages picked and the sort. */
export interface ExploreSearch {
  text: string;
  languages: string[];
  sort: number;
}

/** A page asked of the host: the search, and where the page starts. */
export interface ExploreAsk extends ExploreSearch {
  offset: number;
}

/** The same languages, in any order. */
export function sameLanguages(a: string[], b: string[]): boolean {
  const left = new Set(a);
  const right = new Set(b);
  return left.size === right.size && [...left].every((l) => right.has(l));
}

/** Whether the host was last asked for the search shown (any page of it): the same text, sort and languages, in any order. */
export function askedFor(ask: ExploreAsk | null, shown: ExploreSearch): boolean {
  return ask !== null && ask.text === shown.text && ask.sort === shown.sort && sameLanguages(ask.languages, shown.languages);
}

/** Whether a change from one search to another can be asked at once (a sort or a language picked) or waits for typing
 *  to pause (the text changed). */
export function askAtOnce(asked: ExploreSearch, shown: ExploreSearch): boolean {
  return asked.text === shown.text;
}

/** The home list while the host hasn't answered: `ready` (answered), `refreshing` (a new sort or languages for the same
 *  text: the rows stay, dimmed, until the answer) or `loading` (the page is another text's, e.g. the search just left:
 *  never passed off as "All communities", so the rows wait). */
export type HomeList = 'ready' | 'refreshing' | 'loading';

/** What the home view does while the host hasn't answered the search shown (`stale`): the list (`HomeList`), and
 *  whether the parts worked out from the page (the hero's count, Popular) wait too. They do only when the page is for
 *  other languages or another text; a new sort doesn't change them, so they stay as they are. */
export function homeRefresh(page: ExploreSearch, shown: ExploreSearch, stale: boolean): { list: HomeList; top: boolean } {
  if (!stale) return { list: 'ready', top: false };
  if (page.text !== shown.text) return { list: 'loading', top: true };
  return { list: 'refreshing', top: !sameLanguages(page.languages, shown.languages) };
}
