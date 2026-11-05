import type { CommunityMatch, ExploreCommunitiesResponse, OpenChat } from "@client";
import { describe, expect, test, vi } from "vitest";
import { FEATURED_COMMUNITY_COUNT, FeaturedCommunities } from "./featuredCommunities.svelte";

type Explore = OpenChat["exploreCommunities"];

const match = (communityId: string) =>
    ({ id: { kind: "community", communityId } }) as CommunityMatch;

const top = (...ids: string[]): ExploreCommunitiesResponse => ({
    kind: "success",
    matches: ids.map(match),
    total: 40,
});

function client(...answers: ExploreCommunitiesResponse[]) {
    const exploreCommunities = vi.fn<Explore>();
    answers.forEach((a) => exploreCommunities.mockImplementationOnce(() => Promise.resolve(a)));
    return { exploreCommunities };
}

const ids = (featured: FeaturedCommunities) => featured.matches.map((m) => m.id.communityId);

describe("Landing's featured communities", () => {
    test("Landing's featured communities are fetched with moderation flags 0", async () => {
        const c = client(top("a", "b", "c", "d"));
        const featured = new FeaturedCommunities(c);
        await featured.want(true);
        expect(c.exploreCommunities).toHaveBeenCalledWith(
            undefined,
            0,
            FEATURED_COMMUNITY_COUNT,
            0,
            [],
        );
        expect(ids(featured)).toEqual(["a", "b", "c", "d"]);
    });

    test("aren't asked for until the client can answer", async () => {
        const c = client(top("a"));
        const featured = new FeaturedCommunities(c);
        await featured.want(false);
        expect(c.exploreCommunities).not.toHaveBeenCalled();
        expect(featured.matches).toEqual([]);
    });

    test("are asked for once, however often they're wanted", async () => {
        const c = client(top("a"), top("b"));
        const featured = new FeaturedCommunities(c);
        await Promise.all([featured.want(true), featured.want(true)]);
        await featured.want(true);
        expect(c.exploreCommunities).toHaveBeenCalledTimes(1);
        expect(ids(featured)).toEqual(["a"]);
    });

    test("a failed load shows none, and is tried again when next wanted", async () => {
        const c = client({ kind: "offline" }, top("a"));
        const featured = new FeaturedCommunities(c);
        await featured.want(true);
        expect(featured.matches).toEqual([]);
        await featured.want(true);
        expect(ids(featured)).toEqual(["a"]);
    });
});
