import { describe, expect, test } from "vitest";
import { regenerateOptions } from "./dailyPuzzleOperator";

describe("regenerate today options (#9334 invariant 54)", () => {
    test("as scheduled plus one entry per game the app can render", () => {
        expect(regenerateOptions(["light_up", "tents"])).toEqual([
            { value: "", label: "As scheduled" },
            { value: "light_up", label: "light_up" },
            { value: "tents", label: "tents" },
        ]);
    });

    test("no games leaves only as scheduled", () => {
        expect(regenerateOptions([])).toEqual([{ value: "", label: "As scheduled" }]);
    });
});
