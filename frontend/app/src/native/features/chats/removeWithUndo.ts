import type { LeaveOrDelete, OpenChat } from "@client";
import { toastStore } from "@src/stores/toast";
import type { ScreenContext } from "../app/screens";

/**
 * Leaves a group or deletes a DM with Undo (notes §1: destructive actions show Undo, no confirm).
 * The backend can't undo either, so the chat goes from the list at once and the leave or delete is
 * sent once the toast has gone (the shell's PendingRemovals); Undo sends nothing. The Chats tab's
 * row menu, the conversation's header menu and the details do it.
 */
export function removeWithUndo(
    client: Pick<OpenChat, "leaveOrDelete">,
    context: Pick<ScreenContext, "toast" | "removals">,
    key: string,
    action: LeaveOrDelete,
    message: string,
): void {
    sendAfterUndo(context, key, message, async () =>
        // the native tree shows one column: deleting the open group leaves the list showing
        toastStore.showOutcome(await client.leaveOrDelete(action, true)),
    );
}

/**
 * Something the backend can't undo (a leave, a member removed), offered with Undo: it's hidden
 * at once under `key` (the shell's PendingRemovals), and `commit` sends it once the toast has gone;
 * Undo sends nothing and brings it back, then runs `onUndo` (going back to what was left).
 */
export function sendAfterUndo(
    context: Pick<ScreenContext, "toast" | "removals">,
    key: string,
    message: string,
    commit: () => Promise<void>,
    onUndo?: () => void,
): void {
    const dismiss = context.toast(message, () => {
        context.removals.undo(key);
        onUndo?.();
    });
    context.removals.remove(
        key,
        () => void commit(),
        // sent, or taken back: the toast's Undo has nothing left to undo
        dismiss,
    );
}
