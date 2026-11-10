import { describe, expect, test } from "vitest";
import { memberTabCounts } from "./members.adapter";

describe("the Members screen's tabs", () => {
    test("Lapsed shows a count only while someone has lapsed, the other tabs none", () => {
        expect(memberTabCounts(["members", "lapsed", "blocked"], 3)).toEqual([null, 3, null]);
        expect(memberTabCounts(["members", "lapsed", "blocked"], 0)).toEqual([null, null, null]);
        expect(memberTabCounts(["members", "blocked"], 2)).toEqual([null, null]);
    });
});
