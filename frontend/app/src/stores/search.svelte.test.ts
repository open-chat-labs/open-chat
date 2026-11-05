import type { CommunityMatch, ExploreCommunitiesResponse, OpenChat } from "@client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
    communitySearchState,
    heldCommunitySearch,
    sameCommunitySearch,
    sameLanguages,
    searchCommunities,
    topCommunities,
} from "./search.svelte";

function match(communityId: string): CommunityMatch {
    return { id: { kind: "community", communityId } } as CommunityMatch;
}

describe("SearchState.appendResults", () => {
    test("drops items a previous page already delivered", () => {
        communitySearchState.results = [match("a"), match("b")];
        communitySearchState.appendResults([match("b"), match("c"), match("c")]);
        expect(communitySearchState.results.map((c) => c.id.communityId)).toEqual(["a", "b", "c"]);
    });

    test("replacing the results does not dedupe against the old page", () => {
        communitySearchState.results = [match("a")];
        communitySearchState.results = [match("a"), match("b")];
        expect(communitySearchState.results).toHaveLength(2);
    });
});

type Explore = OpenChat["exploreCommunities"];

function client(...answers: (ExploreCommunitiesResponse | Promise<ExploreCommunitiesResponse>)[]) {
    const exploreCommunities = vi.fn<Explore>();
    answers.forEach((a) => exploreCommunities.mockImplementationOnce(() => Promise.resolve(a)));
    return { exploreCommunities };
}

const page = (ids: string[], total: number): ExploreCommunitiesResponse => ({
    kind: "success",
    matches: ids.map(match),
    total,
});

const ids = () => communitySearchState.results.map((c) => c.id.communityId);

const search = {
    term: "",
    languages: ["fr"],
    flags: 3,
    pageSize: 2,
};

describe("searchCommunities", () => {
    beforeEach(() => {
        communitySearchState.results = [];
        communitySearchState.total = 0;
        communitySearchState.index = 0;
    });

    test("asks for the first page with the filters given, sending an empty term as none", async () => {
        const c = client(page(["a", "b"], 5));
        expect(await searchCommunities(c, { ...search, page: "first" })).toBe("success");
        expect(c.exploreCommunities).toHaveBeenCalledWith(undefined, 0, 2, 3, ["fr"]);
        expect(ids()).toEqual(["a", "b"]);
        expect(communitySearchState.total).toBe(5);
        expect(heldCommunitySearch()).toEqual({ term: "", languages: ["fr"], flags: 3 });
    });

    test("the next page is the one after the last held, and adds to the results", async () => {
        const c = client(page(["a", "b"], 5), page(["c", "d"], 5));
        await searchCommunities(c, { ...search, term: "rust", page: "first" });
        await searchCommunities(c, { ...search, term: "rust", page: "next" });
        expect(c.exploreCommunities).toHaveBeenLastCalledWith("rust", 1, 2, 3, ["fr"]);
        expect(ids()).toEqual(["a", "b", "c", "d"]);
    });

    // Invariant 2: a later page never adds a community already in the list
    test("a later page never adds a community already in the list", async () => {
        const c = client(page(["a", "b"], 5), page(["b", "c"], 5));
        await searchCommunities(c, { ...search, page: "first" });
        await searchCommunities(c, { ...search, page: "next" });
        expect(ids()).toEqual(["a", "b", "c"]);
    });

    test("a page shorter than asked for is the last, so nothing more is offered", async () => {
        const c = client(page(["a", "b"], 5), page(["b"], 5));
        await searchCommunities(c, { ...search, page: "first" });
        await searchCommunities(c, { ...search, page: "next" });
        expect(communitySearchState.total).toBe(2);
    });

    test("a failed page keeps the results, and Load more asks for the same page again", async () => {
        const c = client(page(["a", "b"], 5), { kind: "offline" }, page(["c", "d"], 5));
        await searchCommunities(c, { ...search, page: "first" });
        expect(await searchCommunities(c, { ...search, page: "next" })).toBe("failed");
        expect(ids()).toEqual(["a", "b"]);
        await searchCommunities(c, { ...search, page: "next" });
        expect(c.exploreCommunities).toHaveBeenLastCalledWith(undefined, 1, 2, 3, ["fr"]);
    });

    test("a request that throws is a failure", async () => {
        const c = { exploreCommunities: vi.fn<Explore>(() => Promise.reject(new Error("x"))) };
        expect(await searchCommunities(c, { ...search, page: "first" })).toBe("failed");
    });

    test("only the latest search's answer is kept", async () => {
        let answerOld: (r: ExploreCommunitiesResponse) => void = () => undefined;
        const c = {
            exploreCommunities: vi
                .fn<Explore>()
                .mockImplementationOnce(() => new Promise((resolve) => (answerOld = resolve)))
                .mockImplementationOnce(() => Promise.resolve(page(["new"], 1))),
        };
        const old = searchCommunities(c, { ...search, term: "o", page: "first" });
        expect(await searchCommunities(c, { ...search, term: "ne", page: "first" })).toBe(
            "success",
        );
        answerOld(page(["old"], 1));
        expect(await old).toBe("superseded");
        expect(ids()).toEqual(["new"]);
        expect(heldCommunitySearch()?.term).toBe("ne");
    });
});

describe("sameCommunitySearch", () => {
    test("the same term, flags and languages in any order", () => {
        expect(
            sameCommunitySearch(
                { term: "a", flags: 1, languages: ["en", "fr"] },
                { term: "a", flags: 1, languages: ["fr", "en"] },
            ),
        ).toBe(true);
    });

    test("a different term, flags or languages", () => {
        const key = { term: "a", flags: 1, languages: ["en"] };
        expect(sameCommunitySearch(key, { ...key, term: "b" })).toBe(false);
        expect(sameCommunitySearch(key, { ...key, flags: 0 })).toBe(false);
        expect(sameCommunitySearch(key, { ...key, languages: [] })).toBe(false);
        expect(sameCommunitySearch(key, { ...key, languages: ["fr"] })).toBe(false);
    });
});

describe("sameLanguages", () => {
    test("compares the languages picked as sets", () => {
        expect(sameLanguages(["en", "fr"], ["fr", "en", "en"])).toBe(true);
        expect(sameLanguages(["en", "en"], ["en", "fr"])).toBe(false);
        expect(sameLanguages(["en", "fr"], ["en", "en"])).toBe(false);
        expect(sameLanguages([], [])).toBe(true);
    });
});

describe("results set outside searchCommunities", () => {
    beforeEach(() => {
        communitySearchState.results = [];
    });

    test("answer no search, so explore doesn't take them for its own", async () => {
        await searchCommunities(client(page(["a"], 1)), { ...search, page: "first" });
        expect(heldCommunitySearch()).toBeDefined();
        // a proposal's community finder, searching for its own term with no flags
        communitySearchState.results = [match("finder")];
        expect(heldCommunitySearch()).toBeUndefined();
    });

    test("drop the answer of a search still in flight", async () => {
        let answer: (r: ExploreCommunitiesResponse) => void = () => undefined;
        const c = {
            exploreCommunities: vi.fn<Explore>(
                () => new Promise<ExploreCommunitiesResponse>((resolve) => (answer = resolve)),
            ),
        };
        const pending = searchCommunities(c, { ...search, page: "first" });
        communitySearchState.results = [match("finder")];
        answer(page(["explore"], 1));
        expect(await pending).toBe("superseded");
        expect(ids()).toEqual(["finder"]);
        expect(heldCommunitySearch()).toBeUndefined();
    });

    test("cancel drops the answer of a search still in flight", async () => {
        let answer: (r: ExploreCommunitiesResponse) => void = () => undefined;
        const c = {
            exploreCommunities: vi.fn<Explore>(
                () => new Promise<ExploreCommunitiesResponse>((resolve) => (answer = resolve)),
            ),
        };
        const pending = searchCommunities(c, { ...search, page: "first" });
        communitySearchState.cancel();
        answer(page(["late"], 1));
        expect(await pending).toBe("superseded");
        expect(ids()).toEqual([]);
    });
});

describe("topCommunities", () => {
    beforeEach(() => {
        communitySearchState.results = [];
    });

    test("Landing's featured communities are fetched with moderation flags 0", async () => {
        const c = client(page(["a", "b", "c"], 40));
        const top = await topCommunities(c, 3);
        expect(top?.matches.map((m) => m.id.communityId)).toEqual(["a", "b", "c"]);
        expect(top?.total).toBe(40);
        // the ranking's first page: no search, no languages, and nothing adult or offensive
        expect(c.exploreCommunities).toHaveBeenCalledWith(undefined, 0, 3, 0, []);
    });

    test("leaves explore's results alone", async () => {
        communitySearchState.results = [match("explore")];
        await topCommunities(client(page(["top"], 1)), 3);
        expect(ids()).toEqual(["explore"]);
    });

    test("a failure, or a request that throws, is none", async () => {
        expect(await topCommunities(client({ kind: "offline" }), 3)).toBeUndefined();
        const throws = { exploreCommunities: vi.fn<Explore>(() => Promise.reject(new Error("x"))) };
        expect(await topCommunities(throws, 3)).toBeUndefined();
    });
});
