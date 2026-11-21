import {
    defaultChatPermissions,
    ROLE_ADMIN,
    ROLE_MEMBER,
    type ChatPermissions,
    type GroupChatIdentifier,
} from "@client";
import { describe, expect, test } from "vitest";
import { SAVED_THREADS_MS, SavedThreadPermissions } from "./savedThreads";

const chatId: GroupChatIdentifier = { kind: "group_chat", groupId: "g" };
const other: GroupChatIdentifier = { kind: "group_chat", groupId: "h" };

// what the client's local update shows after a save that left threads following the messages
const merged: ChatPermissions = {
    ...defaultChatPermissions(),
    pinMessages: ROLE_ADMIN,
    threadPermissions: { default: ROLE_MEMBER },
};

describe("threads' permissions read back after a save", () => {
    test("threads saved as following the messages read so within the minute", () => {
        const saved = new SavedThreadPermissions();
        saved.remember(chatId, undefined, 1000);
        expect(saved.apply(chatId, merged, 1000 + SAVED_THREADS_MS - 1)).toEqual({
            ...merged,
            threadPermissions: undefined,
        });
    });

    test("threads saved with permissions of their own read as saved", () => {
        const saved = new SavedThreadPermissions();
        saved.remember(chatId, { default: ROLE_ADMIN }, 0);
        expect(saved.apply(chatId, merged, 10).threadPermissions).toEqual({ default: ROLE_ADMIN });
    });

    test("after the minute, and for other chats, the chat's own are read", () => {
        const saved = new SavedThreadPermissions();
        saved.remember(chatId, undefined, 0);
        expect(saved.apply(other, merged, 10)).toBe(merged);
        expect(saved.apply(chatId, merged, SAVED_THREADS_MS)).toBe(merged);
        // and it's forgotten
        expect(saved.apply(chatId, merged, 10)).toBe(merged);
    });
});
