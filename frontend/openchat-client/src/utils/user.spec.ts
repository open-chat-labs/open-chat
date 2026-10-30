import {
    ChatMap,
    deletedUser,
    type DirectChatSummary,
    type UserLookup,
    type UserSummary,
    type WebhookDetails,
} from "@shared";
import { _, addMessages, init } from "svelte-i18n";
import { get } from "svelte/store";
import { vi } from "vitest";
import {
    botOwnerCandidates,
    buildUsernameList,
    compareUsername,
    directChatUsers,
    isDeletedWebhook,
    missingUserIds,
    shouldRestartForNewUserId,
    userBadges,
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

    const users: UserLookup = new Map([
        ...lookup,
        ["bot", { ...lookup.get("a")!, kind: "bot", userId: "bot", username: "bot" }],
        ["deleted", deletedUser("deleted")],
    ]);
    const chats = ChatMap.fromList([
        directChat("a", BigInt(1)),
        directChat("bot", BigInt(2)),
        directChat("xyz", BigInt(3)),
        directChat("unknown", BigInt(4)),
        directChat("deleted", BigInt(5)),
    ]);

    test("most recent first, leaving out bots, deleted users and users not loaded", () => {
        const result = directChatUsers(chats, users).map((u) => u.userId);

        expect(result).toEqual(["xyz", "a"]);
    });

    test("a bot's owner can pass it on or keep it", () => {
        const result = botOwnerCandidates(chats, users, "alpha").map((u) => u.userId);

        expect(result).toEqual(["alpha", "xyz", "a"]);
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

describe("userBadges", () => {
    // 4a invariant 4: never a verified badge, and no CHIT badge when the viewer turned CHIT off
    test("has no verified badge, and no CHIT badges when CHIT is off", () => {
        const user = { diamondStatus: "lifetime" as const, streak: 5, chitEarned: 1000 };
        expect(userBadges(user, false)).toEqual({
            diamond: "lifetime",
            chit: { streak: 5, earned: 1000 },
        });
        expect(userBadges(user, true)).toEqual({ diamond: "lifetime", chit: undefined });
    });
});

describe("deleted webhooks", () => {
    const live = { id: "live", name: "Relay" } as unknown as WebhookDetails;
    const webhooks = new Map([[live.id, live]]);
    // both have sent messages in the chat
    const webhookUserIds = new Set(["live", "gone"]);

    test("a webhook which sent messages but is no longer the chat's is deleted", () => {
        expect(isDeletedWebhook("gone", webhooks, webhookUserIds, true)).toBe(true);
    });

    test("a webhook the chat still has is not", () => {
        expect(isDeletedWebhook("live", webhooks, webhookUserIds, true)).toBe(false);
    });

    test("an id never seen as a webhook is not", () => {
        expect(isDeletedWebhook("user", webhooks, webhookUserIds, true)).toBe(false);
    });

    test("nothing is concluded before the chat's details load", () => {
        expect(isDeletedWebhook("gone", new Map(), webhookUserIds, false)).toBe(false);
    });

    test("nothing is concluded without the chat's webhooks", () => {
        expect(isDeletedWebhook("gone", undefined, webhookUserIds, true)).toBe(false);
    });
});
