import type { ChatSummary, UserLookup, UserSummary } from "@client";
import { describe, expect, test } from "vitest";
import { matchingChats, newPeople, resultSection, searchTerm, splitAtMatch } from "./chatSearch";

const membership = { archived: false };

function dm(userId: string): ChatSummary {
    return {
        kind: "direct_chat",
        id: { kind: "direct_chat", userId },
        them: { kind: "direct_chat", userId },
        membership,
    } as ChatSummary;
}

function group(groupId: string, name: string, archived = false): ChatSummary {
    return {
        kind: "group_chat",
        id: { kind: "group_chat", groupId },
        name,
        description: "",
        membership: { archived },
    } as ChatSummary;
}

const user = (userId: string, username: string, displayName?: string) =>
    ({ userId, username, displayName }) as UserSummary;

const users: UserLookup = new Map([["lucy", user("lucy", "lucy_l", "Lucy Linden")]]);

describe("searchTerm", () => {
    test("is the text trimmed, without a leading @, in lower case", () => {
        expect(searchTerm("  @Lucy ")).toBe("lucy");
        expect(searchTerm("   ")).toBe("");
    });
});

describe("matchingChats", () => {
    const chats = [dm("lucy"), group("g1", "Hikers"), group("g2", "Old hikes", true)];

    test("matches a DM's names and a group's name, archived chats too, in the list's order", () => {
        expect(matchingChats(chats, "linden", users)).toEqual([chats[0]]);
        expect(matchingChats(chats, "hike", users)).toEqual([chats[1], chats[2]]);
    });

    test("nothing to look for finds nothing", () => {
        expect(matchingChats(chats, "", users)).toEqual([]);
    });
});

describe("newPeople", () => {
    test("leaves out the user and anyone they already have a DM with", () => {
        const found = [user("me", "me"), user("lucy", "lucy_l"), user("matt", "matt")];
        expect(newPeople(found, [dm("lucy")], "me").map((u) => u.userId)).toEqual(["matt"]);
    });
});

describe("resultSection", () => {
    test("shows the first few until Show all, and says whether there's more", () => {
        expect(resultSection([1, 2, 3, 4], 3, false)).toEqual({
            rows: [1, 2, 3],
            total: 4,
            more: true,
        });
        expect(resultSection([1, 2, 3, 4], 3, true).rows).toEqual([1, 2, 3, 4]);
        expect(resultSection([1, 2], 3, false).more).toBe(false);
    });
});

describe("splitAtMatch", () => {
    test("splits the text around the first match, whatever its case", () => {
        expect(splitAtMatch("Lucy Linden", "lin")).toEqual({
            before: "Lucy ",
            match: "Lin",
            after: "den",
        });
    });

    test("no match, or no term, is all before", () => {
        expect(splitAtMatch("Lucy", "matt")).toEqual({ before: "Lucy", match: "", after: "" });
        expect(splitAtMatch("Lucy", "")).toEqual({ before: "Lucy", match: "", after: "" });
    });
});
