import type { ChatSummary } from "@client";
import { canDeleteDirectChat } from "@src/utils/directChat";

/** The leave, delete and block items a chat's menus offer, in the header and on its list row. */
export type ChatMenuAction = "leave" | "delete" | "block" | "unblock";

/**
 * A group or channel can be left when the client allows it; a DM with a person can be blocked or
 * unblocked; a DM can be deleted, except the OpenChat bot's.
 */
export function chatMenuActions(
    chat: ChatSummary,
    { canLeave, blocked, isBot }: { canLeave: boolean; blocked: boolean; isBot: boolean },
): ChatMenuAction[] {
    if (chat.kind !== "direct_chat") return canLeave ? ["leave"] : [];
    const actions: ChatMenuAction[] = isBot ? [] : [blocked ? "unblock" : "block"];
    if (canDeleteDirectChat(chat)) actions.push("delete");
    return actions;
}
