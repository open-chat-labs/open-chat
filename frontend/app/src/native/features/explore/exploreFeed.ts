import type { OpenChat } from "@client";
import { exploreSearch, type ExploreSearchQuery } from "@src/logic/explore/exploreSearch";
import {
    communitySearchState,
    searchCommunities,
    type CommunitySearchOutcome,
} from "@src/stores/search.svelte";
import { EXPLORE_PAGE_SIZE } from "./explore.adapter";

// Explore's pages (the shared search, communitySearchState), for its screen and View all: the
// first page of a query, and the next while there's more.

export function exploreFirstPage(
    client: Pick<OpenChat, "exploreCommunities">,
    query: ExploreSearchQuery,
    flags: number,
): Promise<CommunitySearchOutcome> {
    return searchCommunities(client, exploreSearch(query, flags, "first", EXPLORE_PAGE_SIZE));
}

/** The next page, if the results held aren't all there is; undefined if they are. */
export function exploreNextPage(
    client: Pick<OpenChat, "exploreCommunities">,
    query: ExploreSearchQuery,
    flags: number,
): Promise<CommunitySearchOutcome> | undefined {
    if (communitySearchState.results.length >= communitySearchState.total) return undefined;
    return searchCommunities(client, exploreSearch(query, flags, "next", EXPLORE_PAGE_SIZE));
}
