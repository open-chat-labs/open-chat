import { describe, expect, test } from "vitest";
import { userGroupChanged, userGroupName, userGroupProblem } from "./userGroups";

describe("a user group's name", () => {
    test("is trimmed, with its spaces underscores", () => {
        expect(userGroupName("  front end  team ")).toBe("front_end_team");
    });
});

describe("what stops a user group being saved", () => {
    test("a name of 3 to 25 characters as it's saved", () => {
        expect(userGroupProblem("ab", 1, [])).toBe("name_length");
        expect(userGroupProblem("  ab  ", 1, [])).toBe("name_length");
        expect(userGroupProblem("abc", 1, [])).toBeUndefined();
        expect(userGroupProblem("a".repeat(26), 1, [])).toBe("name_length");
    });

    test("another group's name, case aside", () => {
        expect(userGroupProblem("Mods", 1, ["mods"])).toBe("name_taken");
        expect(userGroupProblem("dev team", 1, ["dev_team"])).toBe("name_taken");
    });

    test("at least one member", () => {
        expect(userGroupProblem("mods", 0, [])).toBe("no_members");
    });
});

describe("whether a user group has changed", () => {
    const original = { name: "mods", members: new Set(["a", "b"]) };

    test("a new one, once anything's entered", () => {
        expect(userGroupChanged(undefined, "", new Set<string>())).toBe(false);
        expect(userGroupChanged(undefined, " ", new Set<string>())).toBe(false);
        expect(userGroupChanged(undefined, "", new Set(["a"]))).toBe(true);
    });

    test("its name as saved, or who's in it", () => {
        expect(userGroupChanged(original, "mods ", new Set(["b", "a"]))).toBe(false);
        expect(userGroupChanged(original, "admins", new Set(["a", "b"]))).toBe(true);
        expect(userGroupChanged(original, "mods", new Set(["a", "c"]))).toBe(true);
        expect(userGroupChanged(original, "mods", new Set(["a"]))).toBe(true);
    });
});
