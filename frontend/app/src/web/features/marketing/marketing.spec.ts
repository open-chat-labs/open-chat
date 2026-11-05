import type { RouteParams } from "@client";
import { isEmailLinkPage, landingCommunities, learnPageFor, learnPath } from "./marketing";

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
    test("each of Explore's cards as Landing's, opening the community's preview", () => {
        expect(
            landingCommunities([
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
            ]),
        ).toEqual([
            {
                name: "OpenChat",
                about: "News",
                members: 62504,
                avatarUrl: "/avatar/abc",
                coverUrl: "/banner/abc",
                href: "/community/abc",
            },
        ]);
    });

    test("one with no description has none, and the design's colours stand in for its images", () => {
        expect(landingCommunities([{ key: "x", name: "X", members: 1 }])).toEqual([
            {
                name: "X",
                about: "",
                members: 1,
                avatarUrl: undefined,
                coverUrl: undefined,
                href: "/community/x",
            },
        ]);
    });
});
