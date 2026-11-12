import {
    i18nKey,
    type ChatIdentifier,
    type MessageFormatter,
    type OpenChat,
    type ToastOutcome,
} from "@client";
import { muteChat } from "@src/logic/chats/muteChat";
import { toastStore } from "@src/stores/toast";
import type { ScreenContext } from "../app/screens";

// A chat's toggles from its menus (the Chats tab's rows, a conversation's header), each saying so
// in a toast as it's done (notes §1 Sheets, menus, toasts). The client shows the change at once
// (localUpdates), so the toast does too, rather than once the backend has it: if the backend
// refuses, the client puts the chat back and the failure takes the toast's place. A block offers
// Undo, which only works once it's done: its toast shows at once with a loader, which gives way
// to Undo when the block is in.

type Toasts = Pick<ScreenContext, "toast" | "pendingToast">;

/** Mutes or unmutes a chat's notifications, saying so (`said`) at once. */
export async function muteWithToast(
    client: Pick<OpenChat, "toggleMuteNotifications">,
    toasts: Toasts,
    chatId: ChatIdentifier,
    mute: boolean,
    said: string,
    formatter: MessageFormatter,
): Promise<void> {
    toasts.toast(said);
    const failed = await muteChat(client, chatId, mute, undefined, formatter);
    if (failed !== undefined) toastStore.showFailureToast(failed);
}

/** Adds a chat to the favourites or takes it off, saying so (`said`) at once. */
export async function favouriteWithToast(
    client: Pick<OpenChat, "addToFavourites" | "removeFromFavourites">,
    toasts: Toasts,
    chatId: ChatIdentifier,
    favourite: boolean,
    said: string,
): Promise<void> {
    toasts.toast(said);
    const done = await (favourite
        ? client.addToFavourites(chatId)
        : client.removeFromFavourites(chatId));
    if (!done) toastStore.showFailureToast(i18nKey("native.chats.toast.favouriteFailed"));
}

/** What a block's or unblock's toast says at each step, translated. */
export type BlockWords = {
    blocking: string;
    blocked: string;
    unblocking: string;
    unblocked: string;
};

/**
 * Blocks or unblocks someone through `setBlocked`: the other user in a DM
 * (`setBlockedInDirectChat`), or a member of a group (the details' members). Its toast shows at
 * once with a loader, saying it's on its way ("Blocking @ann…"), then how it went ("Blocked
 * @ann"). A block's offers Undo, which unblocks in the same toast ("Unblocking @ann…", then
 * "Unblocked @ann"). A refusal takes the toast's place with the failure.
 */
export async function blockWithToast(
    setBlocked: (userId: string, blocked: boolean) => Promise<ToastOutcome>,
    toasts: Toasts,
    userId: string,
    blocking: boolean,
    words: BlockWords,
): Promise<void> {
    if (!blocking) {
        return unblockWithToast((id) => setBlocked(id, false), toasts, userId, words);
    }
    const pending = toasts.pendingToast(words.blocking);
    const outcome = await setBlocked(userId, true);
    if (outcome.kind !== "success") {
        pending.failed();
        toastStore.showOutcome(outcome);
        return;
    }
    pending.done({ message: words.blocked, undo: { pending: words.unblocking, run: unblock } });

    // what the toast says once it's unblocked; none if it couldn't (the failure says why)
    async function unblock(): Promise<string | undefined> {
        const outcome = await setBlocked(userId, false);
        if (outcome.kind === "success") return words.unblocked;
        toastStore.showOutcome(outcome);
        return undefined;
    }
}

/** What an unblock's toast says at each step, translated. */
export type UnblockWords = Pick<BlockWords, "unblocking" | "unblocked">;

/**
 * Unblocks someone through `unblock`, which only ever unblocks (a member from a group's Blocked
 * list, or from their profile sheet): its toast shows at once with a loader ("Unblocking @ann…"),
 * then how it went ("Unblocked @ann"). A refusal takes the toast's place with the failure.
 */
export async function unblockWithToast(
    unblock: (userId: string) => Promise<ToastOutcome>,
    toasts: Toasts,
    userId: string,
    words: UnblockWords,
): Promise<void> {
    const pending = toasts.pendingToast(words.unblocking);
    const outcome = await unblock(userId);
    if (outcome.kind === "success") {
        pending.done({ message: words.unblocked });
    } else {
        pending.failed();
        toastStore.showOutcome(outcome);
    }
}
