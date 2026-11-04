import type { RouteParams } from "@client";
import {
    communityOpening,
    EXPLORE_PAGE_SIZE,
    explorePage,
    exploreNeedsSearch,
    exploreQueryFromUrl,
    exploreSearch,
    exploreUrl,
    isExploreRoute,
    languageToggles,
    sameExploreQuery,
} from "./exploreQuery";

const params = (search: string) => new URLSearchParams(search);

describe("the explore query in the URL", () => {
    test("reads the text and the languages", () => {
        expect(exploreQueryFromUrl(params("?q=rust%20lang&lang=fr,de"), ["en"])).toEqual({
            text: "rust lang",
            languages: ["fr", "de"],
        });
    });

    test("without lang, opens on the languages saved on this device", () => {
        expect(exploreQueryFromUrl(params(""), new Set(["en"]))).toEqual({
            text: "",
            languages: ["en"],
        });
    });

    test("an empty lang is no languages", () => {
        expect(exploreQueryFromUrl(params("?lang="), ["en"]).languages).toEqual([]);
    });

    test("writes the text and the languages, keeping the URL's other params", () => {
        expect(
            exploreUrl(params("?profile&q=old"), { text: "rust", languages: ["fr", "de"] }),
        ).toBe("/communities?profile=&q=rust&lang=fr%2Cde");
    });

    test("an empty query is the bare path, and reads back as itself", () => {
        const url = exploreUrl(params(""), { text: "", languages: [] });
        expect(url).toBe("/communities");
        expect(exploreQueryFromUrl(params(url.split("?")[1] ?? ""), [])).toEqual({
            text: "",
            languages: [],
        });
    });

    test("a written query reads back as itself", () => {
        const query = { text: "café & co", languages: ["fr"] };
        const url = new URL(exploreUrl(params(""), query), "https://oc.app");
        expect(exploreQueryFromUrl(url.searchParams, [])).toEqual(query);
    });

    test("the same query has its languages in any order", () => {
        expect(
            sameExploreQuery(
                { text: "a", languages: ["en", "fr"] },
                { text: "a", languages: ["fr", "en"] },
            ),
        ).toBe(true);
        expect(sameExploreQuery({ text: "a", languages: [] }, { text: "b", languages: [] })).toBe(
            false,
        );
    });

    test("/communities and /welcome show explore", () => {
        const route = (kind: RouteParams["kind"]) => ({ kind }) as RouteParams;
        expect(isExploreRoute(route("communities_route"))).toBe(true);
        expect(isExploreRoute(route("welcome_route"))).toBe(true);
        expect(isExploreRoute(route("selected_community_route"))).toBe(false);
    });
});

// Invariant 5: the library's offset / limit map to the right page, so Load more asks for the next
// page and not the first again
describe("the library's offset / limit map to the right page", () => {
    test("offset 0 is the first page again", () => {
        expect(explorePage({ offset: 0 })).toBe("first");
    });

    test("any other offset is the page after the last one held, even one short of a page", () => {
        expect(explorePage({ offset: EXPLORE_PAGE_SIZE })).toBe("next");
        expect(explorePage({ offset: EXPLORE_PAGE_SIZE * 2 - 1 })).toBe("next");
    });
});

// Invariant 1: the explore request carries the viewer's moderation flags, never a constant
describe("the explore request carries the viewer's moderation flags", () => {
    test("the search has the flags, the text and the languages it was given", () => {
        expect(exploreSearch({ text: "rust", languages: ["fr"] }, 5, "first", 6)).toEqual({
            term: "rust",
            languages: ["fr"],
            flags: 5,
            page: "first",
            pageSize: 6,
        });
        expect(exploreSearch({ text: "", languages: [] }, 0, "next", 6).flags).toBe(0);
    });
});

describe("searching on opening", () => {
    const wanted = { term: "rust", languages: ["fr"], flags: 1 };

    test("keeps the results held for the same search", () => {
        expect(exploreNeedsSearch({ ...wanted, languages: ["fr"] }, wanted, 6)).toBe(false);
    });

    test("searches with nothing held, no results, or results for another search", () => {
        expect(exploreNeedsSearch(undefined, wanted, 6)).toBe(true);
        expect(exploreNeedsSearch(wanted, wanted, 0)).toBe(true);
        expect(exploreNeedsSearch({ ...wanted, term: "go" }, wanted, 6)).toBe(true);
        expect(exploreNeedsSearch({ ...wanted, flags: 0 }, wanted, 6)).toBe(true);
    });
});

describe("saving the languages picked", () => {
    test("toggles those dropped and those added, once each", () => {
        expect(languageToggles(new Set(["en", "fr"]), ["fr", "de", "de"])).toEqual(["en", "de"]);
    });

    test("nothing to toggle when the saved languages are those picked", () => {
        expect(languageToggles(["en", "fr"], ["fr", "en"])).toEqual([]);
    });
});

// Invariant 4: cancelling a preview opened from Explore returns to /communities
describe("cancelling a preview opened from Explore returns to /communities", () => {
    test("a community not joined is previewed, coming back to explore with its query", () => {
        expect(communityOpening("abc", false, { text: "rust", languages: [] })).toEqual({
            kind: "preview",
            path: "/community/abc",
            origin: "/communities?q=rust",
        });
        expect(communityOpening("abc", false, { text: "", languages: [] })).toMatchObject({
            origin: "/communities",
        });
    });

    test("a community joined opens", () => {
        expect(communityOpening("abc", true, { text: "rust", languages: [] })).toEqual({
            kind: "open",
            path: "/community/abc",
        });
    });
});
