import type { CommunityMatch, CommunitySummary, OpenChat } from "@client";
import { topCommunities } from "@src/stores/search.svelte";

/** How many communities Landing features: a row of its grid, which is four wide. */
export const FEATURED_COMMUNITY_COUNT = 4;

/** The OpenChat community, pinned first (if it could be loaded), then the ranking's. */
export type Featured = { pinned: CommunitySummary | undefined; ranked: CommunityMatch[] };

/**
 * The OpenChat community first, then the top of the ranking without it, `count` in all. Without
 * the OpenChat community, the ranking's top `count`.
 */
export function pinFirst(
    pinned: CommunitySummary | undefined,
    ranked: CommunityMatch[],
    count: number,
): Featured {
    if (pinned === undefined) return { pinned, ranked: ranked.slice(0, count) };
    const others = ranked.filter((m) => m.id.communityId !== pinned.id.communityId);
    return { pinned, ranked: others.slice(0, count - 1) };
}

/**
 * Landing's featured communities: the OpenChat community (`getOpenChatCommunity`, as mobile's
 * welcome page has it), then the top of Explore's ranking (`topCommunities`, so never an adult or
 * offensive community). They're asked for once the client can answer: until the identity has
 * loaded (`chatsInitialisedStore`, signed out too) the worker has no agent, and the calls would
 * fail. Without the OpenChat community (it couldn't be loaded, or this isn't production) they're
 * the ranking's alone; a ranking that couldn't be loaded leaves none, and the next `want` tries
 * again.
 */
export class FeaturedCommunities {
    #featured = $state<Featured>({ pinned: undefined, ranked: [] });
    #load: "idle" | "loading" | "loaded" = "idle";

    constructor(private client: Pick<OpenChat, "exploreCommunities" | "getOpenChatCommunity">) {}

    public get featured(): Featured {
        return this.#featured;
    }

    /** Loads them if the client is `ready`, unless they're loaded or loading already. */
    public async want(ready: boolean): Promise<void> {
        if (!ready || this.#load !== "idle") return;
        this.#load = "loading";
        // the full count: the OpenChat community may well be among them
        const [pinned, top] = await Promise.all([
            this.#openChatCommunity(),
            topCommunities(this.client, FEATURED_COMMUNITY_COUNT),
        ]);
        if (top === undefined) {
            this.#load = "idle";
            return;
        }
        this.#featured = pinFirst(pinned, top.matches, FEATURED_COMMUNITY_COUNT);
        this.#load = "loaded";
    }

    async #openChatCommunity(): Promise<CommunitySummary | undefined> {
        try {
            return await this.client.getOpenChatCommunity();
        } catch (err) {
            console.warn("The OpenChat community failed to load", err);
            return undefined;
        }
    }
}
