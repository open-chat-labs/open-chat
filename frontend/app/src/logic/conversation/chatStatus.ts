import type { UserSummary } from "@client";

/**
 * What a DM's header says about the other person, in every tree: that their account is suspended,
 * nothing for a bot, else when they were last online (`getLastOnlineDate`).
 */
export type DirectChatStatus = "suspended" | "bot" | "last_online";

export function directChatStatus(
    them: Pick<UserSummary, "kind" | "suspended"> | undefined,
): DirectChatStatus {
    if (them?.suspended ?? false) return "suspended";
    return them?.kind === "bot" ? "bot" : "last_online";
}
