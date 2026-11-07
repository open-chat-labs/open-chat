import type { MessageMenuAction } from "@client";

export type MessageSwipeAction = "edit" | "forward" | "reply";

/**
 * What a committed swipe on a message does. A swipe does exactly one thing: left edits your own
 * message (or replies to it if it can't be edited) and forwards anyone else's; right replies.
 */
export function messageSwipeAction(
    direction: "left" | "right",
    me: boolean,
    canEdit: boolean,
): MessageSwipeAction {
    if (direction === "left") {
        if (!me) return "forward";
        if (canEdit) return "edit";
    }
    return "reply";
}

/**
 * What a left swipe does on a message, as far as its menu offers it (`messageMenu`): undefined
 * where it offers no such thing (someone else's message that can't be forwarded, say), so the
 * swipe isn't taken.
 */
export function messageSwipeLeft(
    mine: boolean,
    actions: ReadonlySet<MessageMenuAction>,
): MessageSwipeAction | undefined {
    const action = messageSwipeAction("left", mine, actions.has("edit"));
    return actions.has(action) ? action : undefined;
}

/**
 * A message's swipes in the native design (native design notes §3.3): right replies (any message
 * its menu offers a reply on), left edits your own (where it offers that); nothing forwards. Each
 * is undefined where the menu doesn't offer it, so that swipe isn't taken.
 */
export function nativeMessageSwipes(
    mine: boolean,
    actions: ReadonlySet<MessageMenuAction>,
): { right: "reply" | undefined; left: "edit" | undefined } {
    return {
        right: actions.has("reply") ? "reply" : undefined,
        left: mine && actions.has("edit") ? "edit" : undefined,
    };
}
