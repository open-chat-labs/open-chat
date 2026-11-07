import type { LeaveOrDelete, OpenChat } from "@client";
import { toastStore } from "@src/stores/toast";
import type { ScreenContext } from "../app/screens";

/**
 * Leaves a group or deletes a DM with Undo (notes §1: destructive actions show Undo, no confirm).
 * The backend can't undo either, so the chat goes from the list at once and the leave or delete is
 * sent once the toast has gone (the shell's PendingRemovals); Undo sends nothing. The Chats tab's
 * row menu and the conversation's header menu both do it.
 */
export function removeWithUndo(
    client: Pick<OpenChat, "leaveOrDelete">,
    context: Pick<ScreenContext, "toast" | "removals">,
    key: string,
    action: LeaveOrDelete,
    message: string,
): void {
    const dismiss = context.toast(message, () => context.removals.undo(key));
    context.removals.remove(
        key,
        async () => toastStore.showOutcome(await client.leaveOrDelete(action)),
        // sent, or taken back: the toast's Undo has nothing left to undo
        dismiss,
    );
}
