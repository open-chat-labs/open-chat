import type { CommunityMatch } from "@client";
import { describe, expect, test } from "vitest";
import { communitySearchState } from "./search.svelte";

function match(communityId: string): CommunityMatch {
    return { id: { kind: "community", communityId } } as CommunityMatch;
}

describe("SearchState.appendResults", () => {
    test("drops items a previous page already delivered", () => {
        communitySearchState.results = [match("a"), match("b")];
        communitySearchState.appendResults([match("b"), match("c"), match("c")]);
        expect(communitySearchState.results.map((c) => c.id.communityId)).toEqual([
            "a",
            "b",
            "c",
        ]);
    });

    test("replacing the results does not dedupe against the old page", () => {
        communitySearchState.results = [match("a")];
        communitySearchState.results = [match("a"), match("b")];
        expect(communitySearchState.results).toHaveLength(2);
    });
});
