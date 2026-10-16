import type { RouteParams } from "@client";
import { learnPageFor, learnPath } from "./marketing";

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
