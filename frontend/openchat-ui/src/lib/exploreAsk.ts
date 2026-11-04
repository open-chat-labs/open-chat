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

/** When to ask the host for the search shown, given the one last asked: `none` (already asked), `now` (a sort or a
 *  language picked, or the text emptied, e.g. leaving the search: nobody is typing) or `debounced` (the text changed:
 *  wait for typing to pause). */
export function askTiming(asked: ExploreAsk, shown: ExploreSearch): 'none' | 'now' | 'debounced' {
  if (askedFor(asked, shown)) return 'none';
  return asked.text === shown.text || shown.text === '' ? 'now' : 'debounced';
}

/** Whether the search view shows (rather than the home view): while there's text, or once the user has opened it (a
 *  click or a key in the hero's search, or focusing the search's own input) until they leave it (Back, Esc). Text that
 *  arrives without the user opening it (the host's, from a URL) shows it only while it's there. */
export function searchViewShown(text: string, openedByUser: boolean): boolean {
  return text.trim() !== '' || openedByUser;
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
