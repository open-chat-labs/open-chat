import { type MultiUserChatIdentifier, type Toast } from "@client";
import type { PendingToast, ToastUndo } from "@openchat/ui/src/native/toastQueue.svelte";
import { PendingRemovals } from "@src/logic/chats/pendingRemovals.svelte";
import { toastStore } from "@src/stores/toast";
import { afterEach, beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import { unpinKey } from "./pinned.adapter";
import { pinWithUndo, unpinWithUndo } from "./pinToasts";

const chatId: MultiUserChatIdentifier = { kind: "group_chat", groupId: "g1" };
const words = { pinned: "Pinned", unpinning: "Unpinning…", unpinned: "Unpinned" };

let appToast: Toast | undefined;
let unsubscribe: () => void;

beforeEach(() => {
    toastStore.hideToast();
    unsubscribe = toastStore.subscribe((t) => (appToast = t));
});
afterEach(() => {
    unsubscribe();
    vi.useRealTimers();
});

describe("pinning", () => {
    let done: Mock<PendingToast["done"]>;
    let failed: Mock<() => void>;
    let context: Parameters<typeof pinWithUndo>[1];

    beforeEach(() => {
        done = vi.fn((_result?: { message?: string; undo?: ToastUndo }) => () => {});
        failed = vi.fn();
        context = {
            pendingToast: (_message: string): PendingToast => ({ done, failed }),
            removals: new PendingRemovals(5000),
        };
    });

    test("offers Undo once it's in, which unpins it in the same toast", async () => {
        const client = {
            pinMessage: vi.fn(async () => true),
            unpinMessage: vi.fn(async () => true),
        };
        await pinWithUndo(client, context, chatId, "g1", 7, words);
        expect(client.pinMessage).toHaveBeenCalledWith(chatId, 7);
        const undo = done.mock.calls[0][0]?.undo;
        if (undo === undefined || typeof undo === "function") throw new Error("no async undo");
        expect(undo.pending).toBe("Unpinning…");
        expect(await undo.run()).toBe("Unpinned");
        expect(client.unpinMessage).toHaveBeenCalledWith(chatId, 7);
    });

    // the unpin hasn't been sent: the message is still pinned on the backend
    test("on a pin waiting out its unpin's Undo, takes the unpin back and sends nothing", async () => {
        vi.useFakeTimers();
        const client = {
            pinMessage: vi.fn(async () => true),
            unpinMessage: vi.fn(async () => true),
        };
        const toastGone = vi.fn();
        unpinWithUndo(
            client,
            { removals: context.removals, toast: () => toastGone },
            chatId,
            "g1",
            [7],
            "Unpinned",
        );
        await pinWithUndo(client, context, chatId, "g1", 7, words);
        expect(context.removals.has(unpinKey("g1", 7))).toBe(false);
        expect(toastGone).toHaveBeenCalledOnce();
        await vi.advanceTimersByTimeAsync(5000);
        expect(client.pinMessage).not.toHaveBeenCalled();
        expect(client.unpinMessage).not.toHaveBeenCalled();
        expect(done).not.toHaveBeenCalled();
    });

    test("a refusal takes the toast's place with the failure", async () => {
        const client = { pinMessage: vi.fn(async () => false), unpinMessage: vi.fn() };
        await pinWithUndo(client, context, chatId, "g1", 7, words);
        expect(failed).toHaveBeenCalledOnce();
        expect(done).not.toHaveBeenCalled();
        expect(appToast?.kind).toBe("failure");
    });
});

describe("unpinning", () => {
    const DELAY = 5000;
    let removals: PendingRemovals;
    let undo: ToastUndo | undefined;
    let dismissed: Mock<() => void>;
    let context: Parameters<typeof unpinWithUndo>[1];

    beforeEach(() => {
        vi.useFakeTimers();
        removals = new PendingRemovals(DELAY);
        undo = undefined;
        dismissed = vi.fn();
        context = {
            removals,
            toast: (_message: string, u?: ToastUndo) => {
                undo = u;
                return dismissed;
            },
        };
    });

    test("hides the pins at once and sends nothing until the Undo has gone", async () => {
        const client = { unpinMessage: vi.fn(async () => true) };
        unpinWithUndo(client, context, chatId, "g1", [3, 9], "Unpinned");
        expect(removals.has(unpinKey("g1", 3))).toBe(true);
        expect(removals.has(unpinKey("g1", 9))).toBe(true);
        expect(client.unpinMessage).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(DELAY);
        expect(client.unpinMessage).toHaveBeenCalledWith(chatId, 3);
        expect(client.unpinMessage).toHaveBeenCalledWith(chatId, 9);
        expect(removals.has(unpinKey("g1", 3))).toBe(false);
        expect(dismissed).toHaveBeenCalledOnce();
    });

    test("Undo brings every pin back and sends nothing", async () => {
        const client = { unpinMessage: vi.fn(async () => true) };
        unpinWithUndo(client, context, chatId, "g1", [3, 9], "Unpinned");
        if (typeof undo !== "function") throw new Error("no undo");
        undo();
        expect(removals.has(unpinKey("g1", 3))).toBe(false);
        expect(removals.has(unpinKey("g1", 9))).toBe(false);
        await vi.advanceTimersByTimeAsync(DELAY);
        expect(client.unpinMessage).not.toHaveBeenCalled();
        expect(dismissed).toHaveBeenCalledOnce();
    });

    test("a refusal says so", async () => {
        const client = { unpinMessage: vi.fn(async () => false) };
        unpinWithUndo(client, context, chatId, "g1", [3], "Unpinned");
        await vi.advanceTimersByTimeAsync(DELAY);
        expect(appToast?.kind).toBe("failure");
    });
});
