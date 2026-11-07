import type { MessageMatch } from "@client";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
    ChatSearch,
    rankedMatches,
    SEARCH_DEBOUNCE_MS,
    searchTerms,
    type ChatSearchOptions,
} from "./chatSearch.svelte";

const match = (messageIndex: number, score: number) => ({ messageIndex, score }) as MessageMatch;

describe("the matches shown", () => {
    test("are the good ones, newest first", () => {
        expect(rankedMatches([match(3, 10), match(9, 5), match(5, 1)])).toEqual([
            match(9, 5),
            match(3, 10),
        ]);
        expect(rankedMatches([])).toEqual([]);
    });
});

describe("what's searched for", () => {
    const lookup = (name: string) => ({ ann: "u1" })[name];

    test("in a group, an @name that names someone searches for them as a sender", () => {
        expect(searchTerms("@ann hello @bob", true, lookup)).toEqual({
            term: " hello @bob",
            mentions: ["u1"],
        });
    });

    test("in a DM, it's all words", () => {
        expect(searchTerms("@ann hello", false, lookup)).toEqual({
            term: "@ann hello",
            mentions: [],
        });
    });
});

describe("a search in a chat", () => {
    afterEach(() => vi.useRealTimers());

    function setup(found: MessageMatch[] | "failed" = [match(1, 4), match(7, 5), match(4, 3)]) {
        const options = {
            search: vi.fn(async () => (found === "failed" ? undefined : found)),
            group: false,
            lookup: () => undefined,
            onGoTo: vi.fn(),
        } satisfies ChatSearchOptions;
        return { search: new ChatSearch(options), options };
    }

    test("shows the newest match first, then steps to older and newer ones", async () => {
        const { search, options } = setup();
        await search.search("Hello");
        expect(options.search).toHaveBeenCalledWith("hello", []);
        expect(search.matches.map((m) => m.messageIndex)).toEqual([7, 4, 1]);
        expect(options.onGoTo).toHaveBeenLastCalledWith(7);
        expect(search.hasNewer).toBe(false);

        search.older(false);
        search.older(false);
        expect(options.onGoTo).toHaveBeenLastCalledWith(1);
        expect(search.hasOlder).toBe(false);
        // past the oldest it stops, or goes round when asked to
        search.older(false);
        expect(search.current).toBe(2);
        search.older(true);
        expect(options.onGoTo).toHaveBeenLastCalledWith(7);
        search.newer(true);
        expect(options.onGoTo).toHaveBeenLastCalledWith(1);
    });

    test("doesn't search a term too short, or the same text again", async () => {
        const { search, options } = setup();
        await search.search("hi");
        expect(options.search).not.toHaveBeenCalled();
        await search.search("hello");
        await search.search("hello");
        expect(options.search).toHaveBeenCalledTimes(1);
    });

    test("searches again for a search typed again after a shorter one", async () => {
        const { search, options } = setup();
        await search.search("hello");
        await search.search("he");
        await search.search("hello");
        expect(options.search).toHaveBeenCalledTimes(2);
    });

    test("waits for typing to pause", async () => {
        vi.useFakeTimers();
        const { search, options } = setup();
        search.typed("hel");
        search.typed("hello");
        expect(options.search).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
        expect(options.search).toHaveBeenCalledTimes(1);
        expect(options.search).toHaveBeenCalledWith("hello", []);
    });

    test("a failed search shows nothing, and ending it unmarks the match", async () => {
        const { search, options } = setup("failed");
        await search.search("hello");
        expect(search.matches).toEqual([]);
        expect(search.searching).toBe(false);
        search.dispose();
        expect(options.onGoTo).toHaveBeenLastCalledWith(-1);
    });
});
