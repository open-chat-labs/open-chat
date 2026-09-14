import { describe, expect, test } from "vitest";
import { adminTabs } from "./adminTabs";

// #9368 invariant 1: the daily puzzle's levers are operator functions, and get no tab of their own
describe("admin tabs (#9368)", () => {
    test("there is no daily puzzle tab", () => {
        for (const tab of adminTabs) {
            expect(tab.id).not.toMatch(/puzzle/i);
            expect(tab.label).not.toMatch(/puzzle/i);
        }
        expect(adminTabs.map((t) => t.id)).toContain("operator");
        expect(new Set(adminTabs.map((t) => t.id)).size).toBe(adminTabs.length);
    });
});
