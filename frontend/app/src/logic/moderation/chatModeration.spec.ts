import {
    i18nKey,
    unsuspendUserMessage,
    type ChatSummary,
    type UserLookup,
    type UserSummary,
} from "@client";
import { describe, expect, test, vi } from "vitest";
import {
    moderatorChatActionLabel,
    moderatorChatActions,
    suspendee,
    suspendUser,
    unsuspend,
    unsuspendUser,
} from "./chatModeration";

const group = (frozen: boolean) => ({ kind: "group_chat", frozen }) as ChatSummary;
const channel = { kind: "channel", frozen: false } as ChatSummary;
const dm = { kind: "direct_chat" } as ChatSummary;

const moderator = {
    platformModerator: true,
    themSuspended: false,
    isBot: false,
};

describe("a chat menu's moderator items", () => {
    test("nobody but a platform moderator gets any", () => {
        const user = { ...moderator, platformModerator: false };
        expect(moderatorChatActions(group(false), user)).toEqual([]);
        expect(moderatorChatActions(dm, user)).toEqual([]);
    });

    test("a group is frozen or unfrozen, as it is now", () => {
        expect(moderatorChatActions(group(false), moderator)).toEqual(["freeze"]);
        expect(moderatorChatActions(group(true), moderator)).toEqual(["unfreeze"]);
    });

    /** The user's decision (2026-11-12): a community is frozen from its own header menu only. */
    test("a channel offers none: its community's header has Freeze community", () => {
        expect(moderatorChatActions(channel, moderator)).toEqual([]);
    });

    test("the person in a DM is suspended or unsuspended, a bot isn't", () => {
        expect(moderatorChatActions(dm, moderator)).toEqual(["suspend"]);
        expect(moderatorChatActions(dm, { ...moderator, themSuspended: true })).toEqual([
            "unsuspend",
        ]);
        expect(moderatorChatActions(dm, { ...moderator, isBot: true })).toEqual([]);
    });

    test("each has the old menus' words", () => {
        expect(moderatorChatActionLabel("freeze")).toEqual(i18nKey("freezeGroup"));
        expect(moderatorChatActionLabel("unfreeze")).toEqual(i18nKey("unfreezeGroup"));
        expect(moderatorChatActionLabel("unsuspend")).toEqual(i18nKey("unsuspendUser"));
    });
});

describe("unsuspending a user", () => {
    test("says whether it went through", async () => {
        const ok = { unsuspendUser: vi.fn(() => Promise.resolve(true)) };
        expect(await unsuspendUser(ok, "u1")).toEqual({
            kind: "success",
            message: unsuspendUserMessage(true),
        });
        expect(ok.unsuspendUser).toHaveBeenCalledWith("u1");
        const failing = { unsuspendUser: vi.fn(() => Promise.resolve(false)) };
        expect(await unsuspendUser(failing, "u1")).toEqual({
            kind: "failed",
            message: unsuspendUserMessage(false),
        });
    });
});

describe("un-suspending a user in a pending toast", () => {
    const users: UserLookup = new Map([["u1", { userId: "u1", username: "alice" } as UserSummary]]);

    test("says it's on its way, naming them, and calls nothing until it's run", () => {
        const client = { unsuspendUser: vi.fn(() => Promise.resolve(true)) };
        expect(unsuspend(client, "u1", users).pending).toEqual(
            i18nKey("moderationToast.unsuspending", { username: "alice" }),
        );
        expect(client.unsuspendUser).not.toHaveBeenCalled();
    });

    test("then says how it went, naming them (by their id while they're not loaded)", async () => {
        const ok = { unsuspendUser: vi.fn(() => Promise.resolve(true)) };
        expect(await unsuspend(ok, "u1", users).run()).toEqual({
            kind: "success",
            message: i18nKey("moderationToast.unsuspended", { username: "alice" }),
        });
        expect(ok.unsuspendUser).toHaveBeenCalledWith("u1");
        const failing = { unsuspendUser: vi.fn(() => Promise.resolve(false)) };
        expect(await unsuspend(failing, "u2", users).run()).toEqual({
            kind: "failed",
            message: i18nKey("moderationToast.unsuspendFailed", { username: "u2" }),
        });
    });
});

describe("suspending a user", () => {
    const users: UserLookup = new Map([["u1", { userId: "u1", username: "alice" } as UserSummary]]);

    test("goes out with the reason, and names them for the toast", async () => {
        const client = { suspendUser: vi.fn(() => Promise.resolve(true)) };
        expect(await suspendUser(client, "u1", "spam", users)).toEqual({
            kind: "suspended",
            message: i18nKey("userSuspended", { username: "alice" }),
        });
        expect(client.suspendUser).toHaveBeenCalledWith("u1", "spam");
    });

    test("names them by their id while they're not loaded", async () => {
        const client = { suspendUser: vi.fn(() => Promise.resolve(true)) };
        expect(await suspendUser(client, "u2", "", users)).toEqual({
            kind: "suspended",
            message: i18nKey("userSuspended", { username: "u2" }),
        });
    });

    test("says when it didn't go through, naming them, for the dialog to show", async () => {
        const client = { suspendUser: vi.fn(() => Promise.resolve(false)) };
        expect(await suspendUser(client, "u1", "spam", users)).toEqual({
            kind: "failed",
            message: i18nKey("suspendUserFailed", { username: "alice" }),
        });
    });
});

describe("who the suspend dialog names", () => {
    const user = (u: Partial<UserSummary>) =>
        ({ userId: "u1", username: "alice", ...u }) as UserSummary;

    test("their display name, then @username, and their own picture", () => {
        const users: UserLookup = new Map([
            ["u1", user({ displayName: "Alice A", blobUrl: "https://pics/alice.png" })],
        ]);
        expect(suspendee("u1", users)).toEqual({
            name: "Alice A",
            handle: "@alice",
            avatarUrl: "https://pics/alice.png",
        });
    });

    test("their username once without a display name, and no picture without their own", () => {
        const users: UserLookup = new Map([["u1", user({ displayName: undefined })]]);
        expect(suspendee("u1", users)).toEqual({ name: "alice", avatarUrl: undefined });
    });

    test("an empty display name counts as none", () => {
        const users: UserLookup = new Map([["u1", user({ displayName: "" })]]);
        expect(suspendee("u1", users)).toEqual({ name: "alice", avatarUrl: undefined });
    });

    test("their id while they're not loaded", () => {
        expect(suspendee("u2", new Map())).toEqual({ name: "u2" });
    });
});
