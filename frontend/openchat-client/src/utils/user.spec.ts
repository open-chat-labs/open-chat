import { ChatMap, type DirectChatSummary, type UserLookup, type UserSummary } from "@shared";
import { _, addMessages, init } from "svelte-i18n";
import { get } from "svelte/store";
import { vi } from "vitest";
import {
    buildUsernameList,
    compareUsername,
    directChatUsers,
    missingUserIds,
    shouldRestartForNewUserId,
} from "./user";

addMessages("en", {
    you: "you",
    andNMore: ", and {n} more",
    reactions: {
        andYou: ", and you",
    },
});

const now = Date.now();
vi.setSystemTime(now);
init({
    fallbackLocale: "en",
});

const lookup: UserLookup = new Map([
    [
        "a",
        {
            kind: "user",
            userId: "a",
            username: "a",
            displayName: undefined,
            updated: BigInt(0),
            suspended: false,
            diamondStatus: "inactive",
            chitBalance: 0,
            streak: 0,
            maxStreak: 0,
            isUniquePerson: false,
            totalChitEarned: 0,
            hideOnlineStatus: false,
        },
    ],
    [
        "b",
        {
            kind: "user",
            userId: "b",
            username: "b",
            displayName: undefined,
            updated: BigInt(0),
            suspended: false,
            diamondStatus: "inactive",
            chitBalance: 0,
            streak: 0,
            maxStreak: 0,
            isUniquePerson: false,
            totalChitEarned: 0,
            hideOnlineStatus: false,
        },
    ],
    [
        "xyz",
        {
            kind: "user",
            userId: "xyz",
            username: "julian_jelfs",
            displayName: undefined,
            updated: BigInt(0),
            suspended: false,
            diamondStatus: "inactive",
            chitBalance: 0,
            streak: 0,
            maxStreak: 0,
            isUniquePerson: false,
            totalChitEarned: 0,
            hideOnlineStatus: false,
        },
    ],
    [
        "alpha",
        {
            kind: "user",
            userId: "alpha",
            username: "alpha",
            displayName: undefined,
            updated: BigInt(0),
            suspended: false,
            diamondStatus: "inactive",
            chitBalance: 0,
            streak: 0,
            maxStreak: 0,
            isUniquePerson: false,
            totalChitEarned: 0,
            hideOnlineStatus: false,
        },
    ],
]);

describe("build username list", () => {
    test("and you and more", () => {
        const userIds = [...lookup.entries()].map(([k, _]) => k);
        userIds.push("beta");

        const result = buildUsernameList(get(_), new Set(userIds), "alpha", lookup, 2);

        expect(result).toEqual("a, b, and you, and 2 more");
    });

    test("show all", () => {
        const userIds = [...lookup.entries()].map(([k, _]) => k);

        const result = buildUsernameList(get(_), new Set(userIds), undefined, lookup);

        expect(result).toEqual("a, b, julian_jelfs, alpha");
    });

    test("don't show 1 more", () => {
        const userIds = [...lookup.entries()].map(([k, _]) => k);

        const result = buildUsernameList(get(_), new Set(userIds), undefined, lookup, 3);

        expect(result).toEqual("a, b, julian_jelfs, alpha");
    });

    test("do show 1 more if missing", () => {
        const userIds = [...lookup.entries()].map(([k, _]) => k);
        userIds.push("beta");

        const result = buildUsernameList(get(_), new Set(userIds), undefined, lookup);

        expect(result).toEqual("a, b, julian_jelfs, alpha, and 1 more");
    });
});

describe("compare username", () => {
    function toUser(username: string): UserSummary {
        return {
            kind: "user",
            userId: "a",
            username,
            displayName: undefined,
            updated: BigInt(0),
            suspended: false,
            diamondStatus: "inactive",
            chitBalance: 0,
            streak: 0,
            maxStreak: 0,
            isUniquePerson: false,
            totalChitEarned: 0,
            hideOnlineStatus: false,
        };
    }
    test("works with non-null usernames", () => {
        const users = ["zulu", "yanky", "foxtrot", "lima"].map(toUser);
        const sorted = users.sort(compareUsername);
        expect(sorted.map((u) => u.username)).toEqual(["foxtrot", "lima", "yanky", "zulu"]);
    });
});

describe("direct chat users", () => {
    function directChat(userId: string, dateCreated: bigint): DirectChatSummary {
        const id = { kind: "direct_chat", userId } as const;
        return {
            kind: "direct_chat",
            id,
            them: id,
            dateCreated,
            eventsTtlLastUpdated: BigInt(0),
            latestMessage: undefined,
        } as DirectChatSummary;
    }

    test("most recent first, leaving out bots and users not loaded", () => {
        const users: UserLookup = new Map([
            ...lookup,
            ["bot", { ...lookup.get("a")!, kind: "bot", userId: "bot", username: "bot" }],
        ]);
        const chats = ChatMap.fromList([
            directChat("a", BigInt(1)),
            directChat("bot", BigInt(2)),
            directChat("xyz", BigInt(3)),
            directChat("unknown", BigInt(4)),
        ]);

        const result = directChatUsers(chats, users).map((u) => u.userId);

        expect(result).toEqual(["xyz", "a"]);
    });
});

describe("missing userIds", () => {
    test("should work", () => {
        const missing = missingUserIds(lookup, new Set(), new Set(["a", "b", "c", "d", "e"]));
        ["c", "d", "e"].forEach((u) => expect(missing.includes(u)).toBe(true));
    });
});

describe("shouldRestartForNewUserId", () => {
    beforeEach(() => localStorage.clear());

    test("restarts once for each change of id", () => {
        expect(shouldRestartForNewUserId("old", "new")).toBe(true);
        expect(shouldRestartForNewUserId("old", "new")).toBe(false);
        expect(shouldRestartForNewUserId("new", "newer")).toBe(true);
    });

    test("doesn't restart without storage to stop a loop", () => {
        const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
            throw new Error("storage unavailable");
        });
        try {
            expect(shouldRestartForNewUserId("old", "new")).toBe(false);
        } finally {
            spy.mockRestore();
        }
    });
});
