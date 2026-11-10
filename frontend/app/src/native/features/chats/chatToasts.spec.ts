import {
    i18nKey,
    type BlockOutcome,
    type ChatIdentifier,
    type ResourceKey,
    type Toast,
} from "@client";
import type { PendingToast, ToastUndo } from "@openchat/ui/src/native/toastQueue.svelte";
import { toastStore } from "@src/stores/toast";
import { afterEach, beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import { blockWithToast, favouriteWithToast, muteWithToast, unblockWithToast } from "./chatToasts";

const chatId: ChatIdentifier = { kind: "group_chat", groupId: "g1" };
const formatter = ((key: string) => key) as Parameters<typeof muteWithToast>[5];

// a backend call that answers when the test says
function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => (resolve = r));
    return { promise, resolve };
}

let events: string[];
let appToast: Toast | undefined;
let unsubscribe: () => void;
let done: Mock<PendingToast["done"]>;
let failed: Mock<() => void>;

const toasts = {
    toast: (message: string, undo?: ToastUndo) => {
        events.push(`toast:${message}${undo ? "+undo" : ""}`);
        return () => {};
    },
    pendingToast: (message: string): PendingToast => {
        events.push(`pending:${message}`);
        return { done, failed };
    },
};

beforeEach(() => {
    events = [];
    done = vi.fn((_result?: { message?: string; undo?: ToastUndo }) => () => {});
    failed = vi.fn();
    toastStore.hideToast();
    unsubscribe = toastStore.subscribe((t) => (appToast = t));
});
afterEach(() => unsubscribe());

function shownFailure(): ResourceKey | undefined {
    let key: ResourceKey | undefined;
    appToast?.resourceKey.subscribe((k) => (key = k))();
    return key;
}

describe("muting from a menu", () => {
    test("says so before the backend answers", async () => {
        const answer = deferred<boolean>();
        const client = { toggleMuteNotifications: vi.fn(() => answer.promise) };
        const running = muteWithToast(client, toasts, chatId, true, "Muted", formatter);
        expect(events).toEqual(["toast:Muted"]);
        expect(client.toggleMuteNotifications).toHaveBeenCalledWith(chatId, true, undefined);
        answer.resolve(true);
        await running;
        expect(appToast).toBeUndefined();
    });

    test("a refusal takes the toast's place with the failure", async () => {
        const client = { toggleMuteNotifications: vi.fn(async () => false) };
        await muteWithToast(client, toasts, chatId, false, "Unmuted", formatter);
        expect(events).toEqual(["toast:Unmuted"]);
        expect(appToast?.kind).toBe("failure");
    });
});

describe("a favourite from a menu", () => {
    test("says so before the backend answers, adding or taking off", async () => {
        const answer = deferred<boolean>();
        const client = {
            addToFavourites: vi.fn(() => answer.promise),
            removeFromFavourites: vi.fn(async () => true),
        };
        const running = favouriteWithToast(client, toasts, chatId, true, "Added to favourites");
        expect(events).toEqual(["toast:Added to favourites"]);
        answer.resolve(true);
        await running;
        await favouriteWithToast(client, toasts, chatId, false, "Removed from favourites");
        expect(client.removeFromFavourites).toHaveBeenCalledWith(chatId);
        expect(appToast).toBeUndefined();
    });

    test("a refusal says it couldn't", async () => {
        const client = {
            addToFavourites: vi.fn(async () => false),
            removeFromFavourites: vi.fn(async () => true),
        };
        await favouriteWithToast(client, toasts, chatId, true, "Added to favourites");
        expect(shownFailure()).toMatchObject({ key: "native.chats.toast.favouriteFailed" });
    });
});

describe("blocking from a conversation's menu", () => {
    const ok: BlockOutcome = { kind: "success", message: i18nKey("blockUserSucceeded") };
    const refused: BlockOutcome = { kind: "failed", message: i18nKey("unblockUserFailed") };
    const words = {
        blocking: "Blocking @ann…",
        blocked: "Blocked @ann",
        unblocking: "Unblocking @ann…",
        unblocked: "Unblocked @ann",
    };

    // the Undo the block's toast was given, as the toast queue runs it
    function givenUndo(): ToastUndo | undefined {
        return done.mock.calls[0]?.[0]?.undo;
    }

    test("says it's blocking at once, with the loader, then Blocked with Undo once it's in", async () => {
        const answer = deferred<BlockOutcome>();
        const client = { setBlockedInDirectChat: vi.fn(() => answer.promise) };
        const running = blockWithToast(client.setBlockedInDirectChat, toasts, "u1", true, words);
        expect(events).toEqual(["pending:Blocking @ann…"]);
        expect(done).not.toHaveBeenCalled();
        answer.resolve(ok);
        await running;
        expect(done).toHaveBeenCalledTimes(1);
        expect(done.mock.calls[0][0]?.message).toBe("Blocked @ann");
    });

    test("its Undo unblocks in the same toast: Unblocking…, then Unblocked", async () => {
        const client = { setBlockedInDirectChat: vi.fn(async (): Promise<BlockOutcome> => ok) };
        await blockWithToast(client.setBlockedInDirectChat, toasts, "u1", true, words);
        const undo = givenUndo();
        if (undo === undefined || typeof undo === "function") throw new Error("no async undo");
        expect(undo.pending).toBe("Unblocking @ann…");
        expect(await undo.run()).toBe("Unblocked @ann");
        expect(client.setBlockedInDirectChat).toHaveBeenLastCalledWith("u1", false);
    });

    test("an Undo the backend refuses ends the toast for the failure", async () => {
        const client = { setBlockedInDirectChat: vi.fn(async (): Promise<BlockOutcome> => ok) };
        await blockWithToast(client.setBlockedInDirectChat, toasts, "u1", true, words);
        client.setBlockedInDirectChat.mockImplementation(async () => refused);
        const undo = givenUndo();
        if (undo === undefined || typeof undo === "function") throw new Error("no async undo");
        expect(await undo.run()).toBeUndefined();
        expect(appToast?.kind).toBe("failure");
    });

    test("a refused block drops its toast for the failure", async () => {
        const client = {
            setBlockedInDirectChat: vi.fn(
                async (): Promise<BlockOutcome> => ({
                    kind: "failed",
                    message: i18nKey("blockUserFailed"),
                }),
            ),
        };
        await blockWithToast(client.setBlockedInDirectChat, toasts, "u1", true, words);
        expect(failed).toHaveBeenCalledTimes(1);
        expect(done).not.toHaveBeenCalled();
        expect(appToast?.kind).toBe("failure");
    });

    test("unblocking from the menu says so as it goes, then Unblocked", async () => {
        const answer = deferred<BlockOutcome>();
        const client = { setBlockedInDirectChat: vi.fn(() => answer.promise) };
        const running = blockWithToast(client.setBlockedInDirectChat, toasts, "u1", false, words);
        expect(events).toEqual(["pending:Unblocking @ann…"]);
        answer.resolve(ok);
        await running;
        expect(done).toHaveBeenCalledWith({ message: "Unblocked @ann" });
        expect(client.setBlockedInDirectChat).toHaveBeenCalledWith("u1", false);
    });
});

describe("unblocking a group's member", () => {
    const ok: BlockOutcome = { kind: "success", message: i18nKey("unblockUserSucceeded") };
    const words = {
        unblocking: "Unblocking Ann…",
        unblocked: "Unblocked Ann. They can join again",
    };

    // the Members screen's Blocked list and the profile sheet hand it a call that only unblocks
    test("only ever unblocks: Unblocking…, then Unblocked", async () => {
        const answer = deferred<BlockOutcome>();
        const unblock = vi.fn((_userId: string) => answer.promise);
        const running = unblockWithToast(unblock, toasts, "u1", words);
        expect(events).toEqual(["pending:Unblocking Ann…"]);
        answer.resolve(ok);
        await running;
        expect(unblock).toHaveBeenCalledExactlyOnceWith("u1");
        expect(done).toHaveBeenCalledWith({ message: "Unblocked Ann. They can join again" });
    });

    test("a refused unblock drops its toast for the failure", async () => {
        const unblock = vi.fn(
            async (): Promise<BlockOutcome> => ({
                kind: "failed",
                message: i18nKey("unblockUserFailed"),
            }),
        );
        await unblockWithToast(unblock, toasts, "u1", words);
        expect(failed).toHaveBeenCalledTimes(1);
        expect(done).not.toHaveBeenCalled();
        expect(shownFailure()).toEqual(i18nKey("unblockUserFailed"));
    });
});
