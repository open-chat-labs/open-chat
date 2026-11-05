import type {
    CommunityMatch,
    CommunitySummary,
    ExploreCommunitiesResponse,
    OpenChat,
} from "@client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
    FEATURED_COMMUNITY_COUNT,
    FEATURED_RETRIES,
    FEATURED_RETRY_MS,
    FeaturedCommunities,
    pinFirst,
} from "./featuredCommunities.svelte";

type Explore = OpenChat["exploreCommunities"];
type OpenChatCommunity = OpenChat["getOpenChatCommunity"];

const match = (communityId: string) =>
    ({ id: { kind: "community", communityId } }) as CommunityMatch;

const summary = (communityId: string) =>
    ({ id: { kind: "community", communityId } }) as CommunitySummary;

const top = (...ids: string[]): ExploreCommunitiesResponse => ({
    kind: "success",
    matches: ids.map(match),
    total: 40,
});

const offline: ExploreCommunitiesResponse = { kind: "offline" };

/** `openChat`: the OpenChat community each call answers in turn (an Error: it throws), then none. */
function client(
    openChat: (CommunitySummary | undefined | Error)[],
    ...answers: ExploreCommunitiesResponse[]
) {
    const exploreCommunities = vi.fn<Explore>();
    answers.forEach((a) => exploreCommunities.mockImplementationOnce(() => Promise.resolve(a)));
    const getOpenChatCommunity = vi.fn<OpenChatCommunity>(() => Promise.resolve(undefined));
    openChat.forEach((c) =>
        getOpenChatCommunity.mockImplementationOnce(() =>
            c instanceof Error ? Promise.reject(c) : Promise.resolve(c),
        ),
    );
    return { exploreCommunities, getOpenChatCommunity };
}

const ids = (featured: FeaturedCommunities) => ({
    pinned: featured.featured.pinned?.id.communityId,
    ranked: featured.featured.ranked.map((m) => m.id.communityId),
});

describe("pinFirst", () => {
    test("the OpenChat community first, then the ranking's top, the count in all", () => {
        const featured = pinFirst(summary("oc"), ["a", "b", "c", "d"].map(match), 4);
        expect(featured.pinned?.id.communityId).toBe("oc");
        expect(featured.ranked.map((m) => m.id.communityId)).toEqual(["a", "b", "c"]);
    });

    test("never shows the OpenChat community twice, wherever the ranking has it", () => {
        const featured = pinFirst(summary("oc"), ["a", "oc", "b", "c"].map(match), 4);
        expect(featured.ranked.map((m) => m.id.communityId)).toEqual(["a", "b", "c"]);
    });

    test("without the OpenChat community, the ranking's top alone", () => {
        const featured = pinFirst(undefined, ["a", "b", "c", "d", "e"].map(match), 4);
        expect(featured.pinned).toBeUndefined();
        expect(featured.ranked.map((m) => m.id.communityId)).toEqual(["a", "b", "c", "d"]);
    });

    test("a short ranking leaves fewer", () => {
        expect(pinFirst(summary("oc"), [match("oc")], 4).ranked).toEqual([]);
    });
});

describe("Landing's featured communities", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    test("Landing's featured communities are fetched with moderation flags 0", async () => {
        const c = client([], top("a", "b", "c", "d"));
        const featured = new FeaturedCommunities(c);
        await featured.want(true);
        expect(c.exploreCommunities).toHaveBeenCalledWith(
            undefined,
            0,
            FEATURED_COMMUNITY_COUNT,
            0,
            [],
        );
        expect(ids(featured)).toEqual({ pinned: undefined, ranked: ["a", "b", "c", "d"] });
    });

    test("the OpenChat community is pinned first, and not shown again", async () => {
        const c = client([summary("oc")], top("a", "oc", "b", "c"));
        const featured = new FeaturedCommunities(c);
        await featured.want(true);
        expect(ids(featured)).toEqual({ pinned: "oc", ranked: ["a", "b", "c"] });
    });

    test("aren't asked for until the client can answer", async () => {
        const c = client([], top("a"));
        const featured = new FeaturedCommunities(c);
        await featured.want(false);
        expect(c.exploreCommunities).not.toHaveBeenCalled();
        expect(c.getOpenChatCommunity).not.toHaveBeenCalled();
        expect(ids(featured)).toEqual({ pinned: undefined, ranked: [] });
    });

    test("are asked for once, however often they're wanted", async () => {
        const c = client([], top("a"), top("b"));
        const featured = new FeaturedCommunities(c);
        await Promise.all([featured.want(true), featured.want(true)]);
        await featured.want(true);
        await vi.runAllTimersAsync();
        expect(c.exploreCommunities).toHaveBeenCalledTimes(1);
        expect(c.getOpenChatCommunity).toHaveBeenCalledTimes(1);
        expect(ids(featured).ranked).toEqual(["a"]);
    });

    test("a ranking that fails to load shows none, and is retried without being wanted again, keeping the OpenChat community", async () => {
        const c = client([summary("oc")], offline, top("a"));
        const featured = new FeaturedCommunities(c);
        await featured.want(true);
        expect(ids(featured)).toEqual({ pinned: undefined, ranked: [] });
        await vi.advanceTimersByTimeAsync(FEATURED_RETRY_MS);
        expect(ids(featured)).toEqual({ pinned: "oc", ranked: ["a"] });
        // the OpenChat community had loaded: only the ranking was asked for again
        expect(c.getOpenChatCommunity).toHaveBeenCalledTimes(1);
        expect(c.exploreCommunities).toHaveBeenCalledTimes(2);
    });

    test("an OpenChat community that fails to load leaves the ranking as it is, and is retried on its own", async () => {
        const c = client([new Error("x"), summary("oc")], top("a", "b", "c", "d"));
        const featured = new FeaturedCommunities(c);
        await featured.want(true);
        expect(ids(featured)).toEqual({ pinned: undefined, ranked: ["a", "b", "c", "d"] });
        await vi.advanceTimersByTimeAsync(FEATURED_RETRY_MS);
        expect(ids(featured)).toEqual({ pinned: "oc", ranked: ["a", "b", "c"] });
        expect(c.exploreCommunities).toHaveBeenCalledTimes(1);
    });

    test("no OpenChat community (outside production) is no failure: nothing is retried", async () => {
        const c = client([undefined], top("a"));
        const featured = new FeaturedCommunities(c);
        await featured.want(true);
        await vi.runAllTimersAsync();
        expect(c.getOpenChatCommunity).toHaveBeenCalledTimes(1);
        expect(c.exploreCommunities).toHaveBeenCalledTimes(1);
    });

    test("retries back off, doubling, and stop after the last", async () => {
        const c = client([]);
        c.exploreCommunities.mockImplementation(() => Promise.resolve(offline));
        const featured = new FeaturedCommunities(c);
        await featured.want(true);
        for (let retry = 0; retry < FEATURED_RETRIES; retry++) {
            const wait = FEATURED_RETRY_MS * 2 ** retry;
            await vi.advanceTimersByTimeAsync(wait - 1);
            expect(c.exploreCommunities).toHaveBeenCalledTimes(retry + 1);
            await vi.advanceTimersByTimeAsync(1);
            expect(c.exploreCommunities).toHaveBeenCalledTimes(retry + 2);
        }
        await vi.runAllTimersAsync();
        expect(c.exploreCommunities).toHaveBeenCalledTimes(FEATURED_RETRIES + 1);
    });

    test("a page that's gone retries nothing", async () => {
        const c = client([], offline, top("a"));
        const featured = new FeaturedCommunities(c);
        await featured.want(true);
        featured.dispose();
        await vi.runAllTimersAsync();
        expect(c.exploreCommunities).toHaveBeenCalledTimes(1);
    });
});
