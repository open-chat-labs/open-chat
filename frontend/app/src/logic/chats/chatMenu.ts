import { ROLE_NONE, type ChatSummary } from "@client";
import { canDeleteDirectChat } from "@src/utils/directChat";

/** The leave, delete and block items a chat's menus offer, in the header and on its list row. */
export type ChatMenuAction = "leave" | "delete" | "block" | "unblock";

/**
 * A group or channel can be left when the user is a member and the client allows it; a DM with a person can be blocked or
 * unblocked; a DM can be deleted, except the OpenChat bot's.
 */
export function chatMenuActions(
    chat: ChatSummary,
    { canLeave, blocked, isBot }: { canLeave: boolean; blocked: boolean; isBot: boolean },
): ChatMenuAction[] {
    if (chat.kind !== "direct_chat") {
        // a group previewed but not joined has nothing to leave
        return canLeave && chat.membership.role !== ROLE_NONE ? ["leave"] : [];
    }
    const actions: ChatMenuAction[] = isBot ? [] : [blocked ? "unblock" : "block"];
    if (canDeleteDirectChat(chat)) actions.push("delete");
    return actions;
}

/** An item of a chat list row's menu. */
export type ChatRowAction =
    | "pin"
    | "unpin"
    | "favourite"
    | "unfavourite"
    | "mute"
    | "unmute"
    | "mark_read"
    | "archive"
    | "unarchive"
    | "leave"
    | "delete"
    | "remove";

/** What a row's menu depends on besides the chat. */
export type ChatRowMenuState = {
    /** Pinned in the list's scope. */
    pinned: boolean;
    favourite: boolean;
    /** The row's unread count. */
    unread: number;
    /** A group or channel the client lets the user leave (`canLeaveGroup`). */
    canLeave: boolean;
    /** A preview, or a DM with no messages, that can be taken off the list (`canRemoveFromList`). */
    canRemove: boolean;
};

/**
 * A chat list row's menu, in the native design's order (notes §3.2), on the web too: pin,
 * favourite, mute, mark as read while there's something unread, archive (or un-archive) a DM or a
 * chat the user is in, leave a group or delete a DM (`chatMenuActions`; no block on a row), and
 * remove a preview from the list.
 */
export function chatRowMenu(chat: ChatSummary, state: ChatRowMenuState): ChatRowAction[] {
    const actions: ChatRowAction[] = [
        state.pinned ? "unpin" : "pin",
        state.favourite ? "unfavourite" : "favourite",
        chat.membership.notificationsMuted ? "unmute" : "mute",
    ];
    if (state.unread > 0) actions.push("mark_read");
    if (chat.kind === "direct_chat" || chat.membership.role !== ROLE_NONE) {
        actions.push(chat.membership.archived ? "unarchive" : "archive");
    }
    const leaveOrDelete = chatMenuActions(chat, {
        canLeave: state.canLeave,
        blocked: false,
        isBot: false,
    });
    if (leaveOrDelete.includes("leave")) actions.push("leave");
    if (leaveOrDelete.includes("delete")) actions.push("delete");
    if (state.canRemove) actions.push("remove");
    return actions;
}
