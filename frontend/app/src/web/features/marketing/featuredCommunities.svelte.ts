import type { CommunityMatch, OpenChat } from "@client";
import { topCommunities } from "@src/stores/search.svelte";

/** How many communities Landing features: a row of its grid, which is four wide. */
export const FEATURED_COMMUNITY_COUNT = 4;

/**
 * Landing's featured communities: the top of Explore's ranking (`topCommunities`, so never an
 * adult or offensive community). They're asked for once the client can answer: until the
 * identity has loaded (`chatsInitialisedStore`, signed out too) the worker has no agent, and the
 * call would fail. A failed load leaves none, and the next `want` tries again.
 */
export class FeaturedCommunities {
    #matches = $state<CommunityMatch[]>([]);
    #load: "idle" | "loading" | "loaded" = "idle";

    constructor(private client: Pick<OpenChat, "exploreCommunities">) {}

    public get matches(): CommunityMatch[] {
        return this.#matches;
    }

    /** Loads them if the client is `ready`, unless they're loaded or loading already. */
    public async want(ready: boolean): Promise<void> {
        if (!ready || this.#load !== "idle") return;
        this.#load = "loading";
        const top = await topCommunities(this.client, FEATURED_COMMUNITY_COUNT);
        if (top === undefined) {
            this.#load = "idle";
            return;
        }
        this.#matches = top.matches;
        this.#load = "loaded";
    }
}
