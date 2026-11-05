import type { MessageMenuAction } from "@client";

/**
 * What double-clicking a message does, with the "double-click to reply" setting on: edits the
 * user's own message, replies to anyone else's, as far as the message's menu offers that (not a
 * failed or deleted one). Nothing with the setting off.
 */
export function messageDoubleClickAction(
    enabled: boolean,
    message: { mine: boolean; deleted: boolean },
    actions: ReadonlySet<MessageMenuAction>,
): "edit" | "reply" | undefined {
    if (!enabled || message.deleted) return undefined;
    if (message.mine) return actions.has("edit") ? "edit" : undefined;
    return actions.has("reply") ? "reply" : undefined;
}
