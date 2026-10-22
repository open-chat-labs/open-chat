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
