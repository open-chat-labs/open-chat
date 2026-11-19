import {
    sameCommunitySearch,
    type CommunitySearch,
    type CommunitySearchKey,
} from "@src/stores/search.svelte";

// Explore's search, shared by the web's Explore and the native one: what's asked for (the text,
// the languages picked, the viewer's moderation flags), when the results held already answer it,
// and the languages saved on this device so Explore opens on them next time.

/** What Explore shows: the search text and the languages picked, by code. */
export type ExploreSearchQuery = { text: string; languages: string[] };

/**
 * The search for a query. `flags` are the viewer's moderation flags
 * (`exploreCommunitiesFiltersStore`), so adult and offensive communities show only to those who
 * turned them on.
 */
export function exploreSearch(
    query: ExploreSearchQuery,
    flags: number,
    page: CommunitySearch["page"],
    pageSize: number,
): CommunitySearch {
    return { ...exploreSearchKey(query, flags), page, pageSize };
}

/** What results for a query are filtered by (see exploreSearch). */
export function exploreSearchKey(query: ExploreSearchQuery, flags: number): CommunitySearchKey {
    return { term: query.text, languages: query.languages, flags };
}

/**
 * Whether Explore has to search on opening, or when the viewer's flags change: the results held
 * (kept across visits, with their scroll position) are kept unless there are none or they answer
 * another search.
 */
export function exploreNeedsSearch(
    held: CommunitySearchKey | undefined,
    wanted: CommunitySearchKey,
    resultsHeld: number,
): boolean {
    return resultsHeld === 0 || !exploreQueryAnswered(held, wanted);
}

/**
 * Whether the results held already answer a query: one the component asks for where only its sort
 * changed (the backend has one ranking, so every sort is the same page), or the text was changed
 * and changed back before the ask went out; or one the URL changes to (Back, a link) whose results
 * are still held. Asking again would fetch the same page.
 */
export function exploreQueryAnswered(
    held: CommunitySearchKey | undefined,
    wanted: CommunitySearchKey,
): boolean {
    return held !== undefined && sameCommunitySearch(held, wanted);
}

/**
 * The languages to toggle in the saved filter (`toggleCommunityFilterLanguage`) so that it holds
 * exactly those picked, and Explore opens on them next time.
 */
export function languageToggles(saved: Iterable<string>, picked: string[]): string[] {
    const before = [...saved];
    return [
        ...before.filter((l) => !picked.includes(l)),
        ...picked.filter((l, i) => !before.includes(l) && picked.indexOf(l) === i),
    ];
}

/**
 * The moderation flags Explore searches with: the viewer's (adult and offensive communities shown
 * to those who turned them on), none in a store build, which never shows them (`disableRestrictedContent`).
 */
export function exploreFlags(viewerFlags: number, store: boolean): number {
    return store ? 0 : viewerFlags;
}
