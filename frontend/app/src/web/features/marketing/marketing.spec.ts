import type { CommunitySummary, RouteParams } from "@client";
import { vi } from "vitest";
import {
    docPageFor,
    isEmailLinkPage,
    isLegalDoc,
    landingCommunities,
    learnPageFor,
    learnPath,
    pinnedLandingCommunity,
    type DocPage,
} from "./marketing";

const route = (r: object) => ({ scope: { kind: "none" }, ...r }) as RouteParams;

describe("Learn on the marketing paths", () => {
    test("each sub-page's route shows it, and a blog post's slug opens the post", () => {
        expect(learnPageFor(route({ kind: "roadmap_route" }))).toEqual({ page: "roadmap" });
        expect(learnPageFor(route({ kind: "faq_route" }))).toEqual({ page: "faq" });
        expect(learnPageFor(route({ kind: "blog_route" }))).toEqual({ page: "blog" });
        expect(learnPageFor(route({ kind: "blog_route", slug: "chit" }))).toEqual({
            page: "blog",
            post: "chit",
        });
    });

    test("pages that aren't Learn's have none", () => {
        expect(learnPageFor(route({ kind: "terms_route" }))).toBeUndefined();
        expect(learnPageFor(route({ kind: "home_landing_route" }))).toBeUndefined();
    });

    test("links go back to the same paths, with a post's slug encoded", () => {
        expect(learnPath("whitepaper")).toBe("/whitepaper");
        expect(learnPath("blog")).toBe("/blog");
        expect(learnPath("blog", "a/b")).toBe("/blog/a%2Fb");
        expect(learnPageFor(route({ kind: "blog_route", slug: "a/b" }))?.post).toBe("a/b");
    });
});

describe("the doc pages outside Learn's tabs", () => {
    test("each legal page, the moderators' checklist and /diamond are one", () => {
        expect(docPageFor(route({ kind: "terms_route" }))).toBe("terms");
        expect(docPageFor(route({ kind: "privacy_route" }))).toBe("privacy");
        expect(docPageFor(route({ kind: "guidelines_route" }))).toBe("guidelines");
        expect(docPageFor(route({ kind: "csea_reporting_route" }))).toBe("csea");
        expect(docPageFor(route({ kind: "diamond_route" }))).toBe("diamond");
    });

    test("Learn's own pages and Landing aren't", () => {
        expect(docPageFor(route({ kind: "whitepaper_route" }))).toBeUndefined();
        expect(docPageFor(route({ kind: "home_landing_route" }))).toBeUndefined();
    });

    test("only the legal ones are Learn content", () => {
        expect(["terms", "privacy", "guidelines"].every((p) => isLegalDoc(p as DocPage))).toBe(true);
        expect(isLegalDoc("csea")).toBe(false);
        expect(isLegalDoc("diamond")).toBe(false);
        expect(isLegalDoc(undefined)).toBe(false);
    });
});

describe("the email sign-in link's page", () => {
    test("is a URL with ?auth and the link's ?m", () => {
        expect(isEmailLinkPage(new URLSearchParams("auth&m=1&s1=2&s2=3"))).toBe(true);
    });

    test("isn't ?auth on its own, which narrows the sign-in options", () => {
        expect(isEmailLinkPage(new URLSearchParams("auth"))).toBe(false);
        expect(isEmailLinkPage(new URLSearchParams("auth=II"))).toBe(false);
    });
});

describe("Landing's featured communities", () => {
    const noOpen = () => undefined;

    test("each of Explore's cards as Landing's, opening the community's preview", () => {
        expect(
            landingCommunities(
                [
                    {
                        key: "abc",
                        name: "OpenChat",
                        about: "News",
                        members: 62504,
                        channelCount: 4,
                        language: "English",
                        avatarUrl: "/avatar/abc",
                        coverUrl: "/banner/abc",
                    },
                ],
                noOpen,
            ),
        ).toEqual([
            {
                name: "OpenChat",
                about: "News",
                members: 62504,
                avatarUrl: "/avatar/abc",
                coverUrl: "/banner/abc",
                href: "/community/abc",
                onOpen: expect.any(Function),
            },
        ]);
    });

    test("one with no description has none, and the design's colours stand in for its images", () => {
        expect(landingCommunities([{ key: "x", name: "X", members: 1 }], noOpen)).toEqual([
            {
                name: "X",
                about: "",
                members: 1,
                avatarUrl: undefined,
                coverUrl: undefined,
                href: "/community/x",
                onOpen: expect.any(Function),
            },
        ]);
    });

    const openChat = {
        id: { kind: "community", communityId: "oc" },
        name: "OpenChat",
        description: "News",
        memberCount: 62504,
        banner: { blobUrl: "/banner/oc" },
    } as CommunitySummary;

    test("the pinned OpenChat community's card from its summary, as Explore's from a match", () => {
        expect(pinnedLandingCommunity(openChat, "/avatar/oc", noOpen)).toEqual({
            name: "OpenChat",
            about: "News",
            members: 62504,
            avatarUrl: "/avatar/oc",
            coverUrl: "/banner/oc",
            href: "/community/oc",
            onOpen: expect.any(Function),
        });
    });

    test("opening a card says which community, so its preview can come back to Landing", () => {
        const onOpen = vi.fn<(communityId: string) => void>();
        const [ranked] = landingCommunities([{ key: "abc", name: "A", members: 1 }], onOpen);
        ranked.onOpen?.();
        pinnedLandingCommunity(openChat, "/avatar/oc", onOpen).onOpen?.();
        expect(onOpen.mock.calls).toEqual([["abc"], ["oc"]]);
    });
});
