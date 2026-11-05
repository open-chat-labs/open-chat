import type { CommunityMatch, CommunitySummary, OpenChat } from "@client";
import { topCommunities } from "@src/stores/search.svelte";

/** How many communities Landing features: a row of its grid, which is four wide. */
export const FEATURED_COMMUNITY_COUNT = 4;

/** The wait before the first retry of a part that failed to load; it doubles with each retry. */
export const FEATURED_RETRY_MS = 2000;
/** How many times a part that failed to load is retried before Landing goes without it. */
export const FEATURED_RETRIES = 5;

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

/** A part of the featured list: not loaded yet (or failed, to be retried), or loaded. */
type Part<T> = { kind: "pending" } | { kind: "loaded"; value: T };

/**
 * Landing's featured communities: the OpenChat community (`getOpenChatCommunity`, as mobile's
 * welcome page has it), then the top of Explore's ranking (`topCommunities`, so never an adult or
 * offensive community). They're asked for once the client can answer: until the identity has
 * loaded (`chatsInitialisedStore`, signed out too) the worker has no agent, and the calls would
 * fail. Nothing shows until the ranking has loaded. A part that fails to load is retried on its
 * own, after `FEATURED_RETRY_MS`, doubling, `FEATURED_RETRIES` times; what loaded is kept. The
 * OpenChat community the client has none of (outside production) is loaded as none, and the
 * ranking shows alone, as it does while the community is still being retried.
 */
export class FeaturedCommunities {
    #pinned = $state<Part<CommunitySummary | undefined>>({ kind: "pending" });
    #ranked = $state<Part<CommunityMatch[]>>({ kind: "pending" });
    #started = false;
    #retries = 0;
    #timer: ReturnType<typeof setTimeout> | undefined;
    #disposed = false;

    constructor(private client: Pick<OpenChat, "exploreCommunities" | "getOpenChatCommunity">) {}

    public get featured(): Featured {
        if (this.#ranked.kind === "pending") return { pinned: undefined, ranked: [] };
        const pinned = this.#pinned.kind === "loaded" ? this.#pinned.value : undefined;
        return pinFirst(pinned, this.#ranked.value, FEATURED_COMMUNITY_COUNT);
    }

    /** Starts loading them if the client is `ready`, unless it has already. */
    public async want(ready: boolean): Promise<void> {
        if (!ready || this.#started || this.#disposed) return;
        this.#started = true;
        await this.#load();
    }

    /** Stops any retry still to come (the page is gone). */
    public dispose(): void {
        this.#disposed = true;
        clearTimeout(this.#timer);
    }

    // what's still pending: both at first, then only the part that failed
    async #load(): Promise<void> {
        await Promise.all([
            this.#pinned.kind === "pending" ? this.#loadPinned() : undefined,
            this.#ranked.kind === "pending" ? this.#loadRanked() : undefined,
        ]);
        if (this.#disposed) return;
        const failed = this.#pinned.kind === "pending" || this.#ranked.kind === "pending";
        if (failed && this.#retries < FEATURED_RETRIES) {
            const wait = FEATURED_RETRY_MS * 2 ** this.#retries;
            this.#retries += 1;
            this.#timer = setTimeout(() => void this.#load(), wait);
        }
    }

    async #loadPinned(): Promise<void> {
        try {
            const value = await this.client.getOpenChatCommunity();
            this.#pinned = { kind: "loaded", value };
        } catch (err) {
            console.warn("The OpenChat community failed to load", err);
        }
    }

    async #loadRanked(): Promise<void> {
        const top = await topCommunities(this.client, FEATURED_COMMUNITY_COUNT);
        if (top !== undefined) this.#ranked = { kind: "loaded", value: top.matches };
    }
}
