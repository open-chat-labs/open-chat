import type { RouteParams } from "@client";
import type { ExploreQuery } from "@openchat/ui/src/features/components/ExploreCommunities.svelte";
import {
    sameCommunitySearch,
    type CommunitySearch,
    type CommunitySearchKey,
} from "@src/stores/search.svelte";

// Explore's query in the URL (ROUTES.md, "Explore query"): /communities?q=<text>&lang=<codes>, and
// the decisions the screen makes around it.

/** What Explore shows: the search text and the languages picked, by code. */
export type ExploreUrlQuery = { text: string; languages: string[] };

/** The page the library asks for (DATA.md): its own page size. */
export const EXPLORE_PAGE_SIZE = 6;

const EXPLORE_PATH = "/communities";
const TEXT = "q";
const LANGUAGES = "lang";

/** Whether a route shows Explore (`/welcome` maps to it, ROUTES.md). */
export function isExploreRoute(route: RouteParams): boolean {
    return route.kind === "communities_route" || route.kind === "welcome_route";
}

/**
 * The query the URL asks for. Without `lang` it's the languages saved on this device (the
 * filter's last choice, `communityFiltersStore`); `lang=` with nothing is no languages.
 */
export function exploreQueryFromUrl(
    params: URLSearchParams,
    savedLanguages: Iterable<string>,
): ExploreUrlQuery {
    const lang = params.get(LANGUAGES);
    return {
        text: (params.get(TEXT) ?? "").trim(),
        languages: lang === null ? [...savedLanguages] : lang.split(",").filter((l) => l !== ""),
    };
}

/**
 * Explore's URL for a query, keeping the URL's other params (a dialog open over it …). An empty
 * text and no languages are left out.
 */
export function exploreUrl(params: URLSearchParams, query: ExploreUrlQuery): string {
    const next = new URLSearchParams(params);
    next.delete(TEXT);
    next.delete(LANGUAGES);
    if (query.text !== "") next.set(TEXT, query.text);
    if (query.languages.length > 0) next.set(LANGUAGES, query.languages.join(","));
    const search = next.toString();
    return search === "" ? EXPLORE_PATH : `${EXPLORE_PATH}?${search}`;
}

/** Whether two queries show the same communities (the languages in any order). */
export function sameExploreQuery(a: ExploreUrlQuery, b: ExploreUrlQuery): boolean {
    return sameCommunitySearch(exploreSearchKey(a, 0), exploreSearchKey(b, 0));
}

/**
 * The page a library query asks for: offset 0 is the first page again (a new text, languages or
 * sort); any other offset is Load more, the page after the last one held. The held results'
 * count isn't used to work out the page: a repeat dropped from a page would make it ask for the
 * same page again.
 */
export function explorePage(query: Pick<ExploreQuery, "offset">): CommunitySearch["page"] {
    return query.offset === 0 ? "first" : "next";
}

/**
 * The search for a query. `flags` are the viewer's moderation flags
 * (`exploreCommunitiesFiltersStore`), so adult and offensive communities show only to those who
 * turned them on.
 */
export function exploreSearch(
    query: ExploreUrlQuery,
    flags: number,
    page: CommunitySearch["page"],
    pageSize: number,
): CommunitySearch {
    return { ...exploreSearchKey(query, flags), page, pageSize };
}

/** What results for a query are filtered by (see exploreSearch). */
export function exploreSearchKey(query: ExploreUrlQuery, flags: number): CommunitySearchKey {
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
    return held === undefined || resultsHeld === 0 || !sameCommunitySearch(held, wanted);
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

export type CommunityOpening =
    | { kind: "open"; path: string }
    /** `origin`: where cancelling the preview goes back to (`communityPreviewState.setOrigin`). */
    | { kind: "preview"; path: string; origin: string };

/**
 * Opening a community from Explore: one the viewer has joined opens; any other is previewed, and
 * cancelling the preview comes back to Explore with the same query, not the default chat list.
 */
export function communityOpening(
    communityId: string,
    joined: boolean,
    query: ExploreUrlQuery,
): CommunityOpening {
    const path = `/community/${communityId}`;
    return joined
        ? { kind: "open", path }
        : { kind: "preview", path, origin: exploreUrl(new URLSearchParams(), query) };
}
