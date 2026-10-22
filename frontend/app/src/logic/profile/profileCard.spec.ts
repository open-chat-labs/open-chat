import type { UserSummary } from "@client";
import { profileCard, profileCardChat } from "./profileCard";

function user(kind: UserSummary["kind"]): UserSummary {
    return {
        kind,
        userId: "u1",
        username: "alice",
        displayName: undefined,
        updated: 0n,
        suspended: false,
        diamondStatus: "inactive",
        chitBalance: 0,
        totalChitEarned: 0,
        streak: 0,
        maxStreak: 0,
        isUniquePerson: false,
        hideOnlineStatus: false,
    };
}

const clicked = { userId: "u1", chatButton: true, inGlobalContext: false };

describe("the profile card a profile link opens", () => {
    test("invariant 2: a profile-clicked for a bot opens no user dialog", () => {
        expect(profileCard(clicked, user("bot"))).toBeUndefined();
    });

    test("a user, loaded or not yet, gets the card the link asked for", () => {
        expect(profileCard(clicked, user("user"))).toEqual(clicked);
        expect(profileCard(clicked, undefined)).toEqual(clicked);
    });

    test("invariant 3: the Chat button asks for a DM with that user", () => {
        expect(profileCardChat(clicked)).toEqual({ kind: "direct_chat", userId: "u1" });
    });
});
