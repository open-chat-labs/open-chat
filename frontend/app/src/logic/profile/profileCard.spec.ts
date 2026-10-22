import type { UserSummary } from "@client";
import { profileCard, profileCardChat, profileCardShows } from "./profileCard";

function user(kind: UserSummary["kind"]): UserSummary {
    return {
        kind,
        userId: "u1",
        username: "someone",
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

describe("a profile card", () => {
    test("is the clicked link's user, with what the link allows", () => {
        expect(profileCard({ userId: "u1", chatButton: true, inGlobalContext: false })).toEqual({
            userId: "u1",
            chatButton: true,
            inGlobalContext: false,
        });
    });

    test("a profile-clicked for a bot opens no user dialog", () => {
        expect(profileCardShows(user("bot"))).toBe(false);
    });

    test("shows for a person, and for a user not loaded yet", () => {
        expect(profileCardShows(user("user"))).toBe(true);
        expect(profileCardShows(undefined)).toBe(true);
    });

    test("the user dialog's Chat button asks for a DM with that user", () => {
        const card = profileCard({ userId: "u1", chatButton: true, inGlobalContext: true });
        expect(profileCardChat(card)).toEqual({ kind: "direct_chat", userId: "u1" });
    });
});
