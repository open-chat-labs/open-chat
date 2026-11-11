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
 * What a message's left swipe hands the new web tree (`MessageGroup`'s `onSwipeLeft`). The web
 * keeps the group's own mapping (web/05): your own text swipes right to edit and left to reply,
 * through the edit and reply the message offers; any other message swipes right to reply and left
 * to forward, and only the forward comes here. So it's "forward" where the message's menu
 * (`messageMenu`) offers one, and undefined where it doesn't (a message that can't be forwarded),
 * so that swipe isn't taken. Not the old mobile tree's rule (`messageSwipeAction`), where your own
 * message swipes left to edit.
 */
export function webMessageSwipeLeft(
    actions: ReadonlySet<MessageMenuAction>,
): "forward" | undefined {
    return actions.has("forward") ? "forward" : undefined;
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
