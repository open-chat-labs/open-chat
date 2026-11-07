import { i18nKey, type BlockOutcome, type ChatIdentifier, type ResourceKey, type Toast } from "@client";
import type { PendingToast } from "@openchat/ui/src/native/toastQueue.svelte";
import { toastStore } from "@src/stores/toast";
import { afterEach, beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import { blockWithToast, favouriteWithToast, muteWithToast } from "./chatToasts";

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
let done: Mock<(undo?: () => void) => () => void>;
let failed: Mock<() => void>;

const toasts = {
    toast: (message: string, undo?: () => void) => {
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
    done = vi.fn((_undo?: () => void) => () => {});
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

    test("shows its toast at once with a loader, and offers Undo once the block is in", async () => {
        const answer = deferred<BlockOutcome>();
        const client = { setBlockedInDirectChat: vi.fn(() => answer.promise) };
        const running = blockWithToast(client, toasts, "u1", true, "Ann is blocked");
        expect(events).toEqual(["pending:Ann is blocked"]);
        expect(done).not.toHaveBeenCalled();
        answer.resolve(ok);
        await running;
        expect(done).toHaveBeenCalledTimes(1);

        // Undo unblocks
        client.setBlockedInDirectChat.mockImplementation(async () => ok);
        done.mock.calls[0][0]?.();
        expect(client.setBlockedInDirectChat).toHaveBeenLastCalledWith("u1", false);
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
        await blockWithToast(client, toasts, "u1", true, "Ann is blocked");
        expect(failed).toHaveBeenCalledTimes(1);
        expect(done).not.toHaveBeenCalled();
        expect(appToast?.kind).toBe("failure");
    });

    test("unblocking just says so, at once", async () => {
        const client = { setBlockedInDirectChat: vi.fn(async () => ok) };
        await blockWithToast(client, toasts, "u1", false, "Ann is unblocked");
        expect(events).toEqual(["toast:Ann is unblocked"]);
        expect(client.setBlockedInDirectChat).toHaveBeenCalledWith("u1", false);
    });
});
