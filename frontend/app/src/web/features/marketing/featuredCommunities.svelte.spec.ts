import type {
    CommunityMatch,
    CommunitySummary,
    ExploreCommunitiesResponse,
    OpenChat,
} from "@client";
import { describe, expect, test, vi } from "vitest";
import {
    FEATURED_COMMUNITY_COUNT,
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

function client(
    openChat: ReturnType<OpenChatCommunity> | undefined,
    ...answers: ExploreCommunitiesResponse[]
) {
    const exploreCommunities = vi.fn<Explore>();
    answers.forEach((a) => exploreCommunities.mockImplementationOnce(() => Promise.resolve(a)));
    const getOpenChatCommunity = vi.fn<OpenChatCommunity>(
        () => openChat ?? Promise.resolve(undefined),
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
    test("Landing's featured communities are fetched with moderation flags 0", async () => {
        const c = client(undefined, top("a", "b", "c", "d"));
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
        const c = client(Promise.resolve(summary("oc")), top("a", "oc", "b", "c"));
        const featured = new FeaturedCommunities(c);
        await featured.want(true);
        expect(ids(featured)).toEqual({ pinned: "oc", ranked: ["a", "b", "c"] });
    });

    test("an OpenChat community that fails to load leaves the ranking as it is", async () => {
        const c = client(Promise.reject(new Error("x")), top("a", "b", "c", "d"));
        const featured = new FeaturedCommunities(c);
        await featured.want(true);
        expect(ids(featured)).toEqual({ pinned: undefined, ranked: ["a", "b", "c", "d"] });
    });

    test("aren't asked for until the client can answer", async () => {
        const c = client(undefined, top("a"));
        const featured = new FeaturedCommunities(c);
        await featured.want(false);
        expect(c.exploreCommunities).not.toHaveBeenCalled();
        expect(c.getOpenChatCommunity).not.toHaveBeenCalled();
        expect(ids(featured)).toEqual({ pinned: undefined, ranked: [] });
    });

    test("are asked for once, however often they're wanted", async () => {
        const c = client(undefined, top("a"), top("b"));
        const featured = new FeaturedCommunities(c);
        await Promise.all([featured.want(true), featured.want(true)]);
        await featured.want(true);
        expect(c.exploreCommunities).toHaveBeenCalledTimes(1);
        expect(ids(featured).ranked).toEqual(["a"]);
    });

    test("a ranking that fails to load shows none, and is tried again when next wanted", async () => {
        const c = client(Promise.resolve(summary("oc")), { kind: "offline" }, top("a"));
        const featured = new FeaturedCommunities(c);
        await featured.want(true);
        expect(ids(featured)).toEqual({ pinned: undefined, ranked: [] });
        await featured.want(true);
        expect(ids(featured)).toEqual({ pinned: "oc", ranked: ["a"] });
    });
});
