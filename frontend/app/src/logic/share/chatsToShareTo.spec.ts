import type { DirectChatSummary, UserLookup, UserSummary } from "@client";
import { describe, expect, test } from "vitest";
import { chatsToShareTo } from "./chatsToShareTo";

const dm = (userId: string) =>
    ({
        kind: "direct_chat",
        id: { kind: "direct_chat", userId },
        them: { userId },
    }) as DirectChatSummary;

const user = (userId: string, username: string, displayName?: string) =>
    ({ kind: "user", userId, username, displayName }) as UserSummary;

describe("the chats to share to", () => {
    test("a DM goes by its user's display name as plain text, not marked up bold", () => {
        const users: UserLookup = new Map([
            ["u1", user("u1", "zoe", "Zoe")],
            ["u2", user("u2", "adam")],
        ]);
        const targets = chatsToShareTo(
            { canSendMessage: () => true },
            {
                directChats: [dm("u1"), dm("u2")],
                groupChats: [],
                communities: [],
                favourites: new Set(),
                users,
            },
            undefined,
            "",
        );
        expect(targets.directChats.map((t) => [t.name, t.username])).toEqual([
            ["adam", "adam"],
            ["Zoe", "zoe"],
        ]);
    });
});
