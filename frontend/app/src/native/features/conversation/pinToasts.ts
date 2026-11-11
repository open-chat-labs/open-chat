import { i18nKey, type MultiUserChatIdentifier, type OpenChat } from "@client";
import { toastStore } from "@src/stores/toast";
import type { ScreenContext } from "../app/screens";
import { unpinKey } from "./pinned.adapter";

// Pinning and unpinning a message with Undo (native plan 04: "toast with Undo"; notes §1).
//
// An unpin (from a message's menu, the Pinned messages screen's pin button or its Unpin all) isn't
// sent until its Undo has gone (the shell's PendingRemovals, as a leave): the pins go from the
// strip and the screen at once (`unpinKey`), Undo brings them back and sends nothing, so an unpin
// taken back leaves no trace for anyone. A pin shows at once (the client's own optimistic update),
// and its Undo unpins it, in the same toast.

/** What the toasts say, translated. */
export type PinWords = {
    /** "Message pinned" */
    pinned: string;
    /** "Unpinning message…" */
    unpinning: string;
    /** "Message unpinned" */
    unpinned: string;
};

/** Pins the message; its toast offers Undo once the backend has it, which unpins it. */
export async function pinWithUndo(
    client: Pick<OpenChat, "pinMessage" | "unpinMessage">,
    context: Pick<ScreenContext, "pendingToast">,
    chatId: MultiUserChatIdentifier,
    messageIndex: number,
    words: PinWords,
): Promise<void> {
    const pending = context.pendingToast(words.pinned);
    if (!(await client.pinMessage(chatId, messageIndex))) {
        pending.failed();
        toastStore.showFailureToast(i18nKey("pinMessageFailed"));
        return;
    }
    pending.done({
        undo: {
            pending: words.unpinning,
            run: async () => {
                if (await client.unpinMessage(chatId, messageIndex)) return words.unpinned;
                toastStore.showFailureToast(i18nKey("unpinMessageFailed"));
                return undefined;
            },
        },
    });
}

/**
 * Unpins the messages (one, or every pin for Unpin all) once the toast saying so (`message`) has
 * gone, unless its Undo is used first. Meanwhile they're hidden under `unpinKey(chatKey, index)`.
 */
export function unpinWithUndo(
    client: Pick<OpenChat, "unpinMessage">,
    context: Pick<ScreenContext, "toast" | "removals">,
    chatId: MultiUserChatIdentifier,
    chatKey: string,
    messageIndexes: readonly number[],
    message: string,
): void {
    const keys = messageIndexes.map((index) => unpinKey(chatKey, index));
    const dismiss = context.toast(message, () => keys.forEach((key) => context.removals.undo(key)));
    let waiting = keys.length;
    keys.forEach((key, n) =>
        context.removals.remove(
            key,
            () => void unpin(messageIndexes[n]),
            // all sent, or taken back: the toast's Undo has nothing left to undo
            () => {
                waiting -= 1;
                if (waiting === 0) dismiss();
            },
        ),
    );

    async function unpin(messageIndex: number): Promise<void> {
        if (!(await client.unpinMessage(chatId, messageIndex))) {
            toastStore.showFailureToast(i18nKey("unpinMessageFailed"));
        }
    }
}
