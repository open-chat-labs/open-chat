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

/** Whether the host was last asked for the search shown (any page of it): the same text, sort and languages, in any order. */
export function askedFor(ask: ExploreAsk | null, shown: ExploreSearch): boolean {
  if (ask === null || ask.text !== shown.text || ask.sort !== shown.sort) return false;
  const asked = new Set(ask.languages);
  const picked = new Set(shown.languages);
  return asked.size === picked.size && [...asked].every((l) => picked.has(l));
}
