import { i18nKey, type ChatIdentifier, type MessageFormatter, type OpenChat } from "@client";
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

/**
 * Blocks or unblocks the other user in a DM, saying so (`said`) at once. A block's toast waits with
 * a loader until it's in, then offers Undo (an unblock); an unblock just says so.
 */
export async function blockWithToast(
    client: Pick<OpenChat, "setBlockedInDirectChat">,
    toasts: Toasts,
    userId: string,
    blocking: boolean,
    said: string,
): Promise<void> {
    if (!blocking) {
        toasts.toast(said);
        await unblock();
        return;
    }
    const pending = toasts.pendingToast(said);
    const outcome = await client.setBlockedInDirectChat(userId, true);
    if (outcome.kind !== "success") {
        pending.failed();
        toastStore.showOutcome(outcome);
        return;
    }
    pending.done(() => void unblock());

    async function unblock() {
        const outcome = await client.setBlockedInDirectChat(userId, false);
        if (outcome.kind !== "success") toastStore.showOutcome(outcome);
    }
}
