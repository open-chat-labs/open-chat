import type { CommunityMatch } from "@client";
import {
    exploreNeedsSearch,
    exploreSearch,
    exploreSearchKey,
} from "@src/logic/explore/exploreSearch";
import { describe, expect, test } from "vitest";
import { exploreBrowse, exploreRows } from "./explore.adapter";

function match(id: string): CommunityMatch {
    return {
        kind: "community_match",
        id: { kind: "community", communityId: id },
        name: id,
        description: "",
        avatar: {},
        banner: {},
        memberCount: 1,
        channelCount: 1,
        gateConfig: { gate: { kind: "no_gate" }, expiry: undefined },
        flags: 0,
        primaryLanguage: "en",
        verified: false,
    } as CommunityMatch;
}

const found = (n: number) =>
    exploreRows(
        Array.from({ length: n }, (_, i) => match(`c${i}`)),
        new Set<string>(),
    );

describe("Explore (#10375)", () => {
    test("invariant 5: a shelf with fewer than 3 communities is hidden, and with no shelf every community is in one list", () => {
        // Featured takes the top 3: 2 left is too few for Popular
        expect(exploreBrowse(found(5))).toEqual({ kind: "plain", rows: found(5) });

        const browse = exploreBrowse(found(6));
        expect(browse.kind).toBe("shelves");
        if (browse.kind !== "shelves") return;
        expect(browse.featured.map((r) => r.id)).toEqual(["c0", "c1", "c2"]);
        expect(browse.shelves.map((s) => [s.key, s.rows.map((r) => r.rank)])).toEqual([
            ["popular", [4, 5, 6]],
        ]);
    });

    test("invariant 5: the languages picked are what's searched, and picking others searches again", () => {
        const query = { text: "", languages: ["fr", "de"] };
        expect(exploreSearch(query, 0, "first", 12)).toMatchObject({ languages: ["fr", "de"] });

        const held = exploreSearchKey(query, 0);
        expect(
            exploreNeedsSearch(
                held,
                exploreSearchKey({ text: "", languages: ["de", "fr"] }, 0),
                12,
            ),
        ).toBe(false);
        expect(
            exploreNeedsSearch(held, exploreSearchKey({ text: "", languages: ["fr"] }, 0), 12),
        ).toBe(true);
    });
});
