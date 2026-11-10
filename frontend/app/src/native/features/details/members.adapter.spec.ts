import type { MemberTab } from "@client";
import { describe, expect, test } from "vitest";
import { keptTab, memberTabCounts } from "./members.adapter";

describe("the Members screen's tabs", () => {
    test("Lapsed shows a count only while someone has lapsed, the other tabs none", () => {
        expect(memberTabCounts(["members", "lapsed", "blocked"], 3)).toEqual([null, 3, null]);
        expect(memberTabCounts(["members", "lapsed", "blocked"], 0)).toEqual([null, null, null]);
        expect(memberTabCounts(["members", "blocked"], 2)).toEqual([null, null]);
    });

    // the screen keeps what keptTab gives as the tab chosen
    test("a tab that goes goes back to Members, and stays there when the tab comes back", () => {
        const all: MemberTab[] = ["members", "lapsed", "blocked"];
        let chosen: MemberTab = "lapsed";
        chosen = keptTab(chosen, all);
        expect(chosen).toBe("lapsed");
        // the gates taken away
        chosen = keptTab(chosen, ["members", "blocked"]);
        expect(chosen).toBe("members");
        // and given back
        chosen = keptTab(chosen, all);
        expect(chosen).toBe("members");
        // a role lost: no tabs
        expect(keptTab("blocked", [])).toBe("members");
    });
});
