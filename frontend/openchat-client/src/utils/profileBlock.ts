import { i18nKey, type ResourceKey } from "@shared";
import type {
    ChatSummary,
    CommunityIdentifier,
    CommunitySummary,
    GroupChatIdentifier,
    ReadonlySet,
} from "@shared";

/** Where blocking someone from their profile card acts. */
export type BlockContext =
    | { kind: "direct_chat" }
    | { kind: "group_chat"; id: GroupChatIdentifier }
    | { kind: "community"; id: CommunityIdentifier };

/** What the profile card offers: nothing, or to block or unblock its user where it was opened. */
export type ProfileBlock = { kind: "none" } | { kind: "block" | "unblock"; context: BlockContext };

export type ProfileBlockInput = {
    userId: string;
    isMe: boolean;
    inGlobalContext: boolean;
    chat: ChatSummary | undefined;
    community: CommunitySummary | undefined;
    blockedUsers: ReadonlySet<string>;
    blockedChatUsers: ReadonlySet<string>;
    blockedCommunityUsers: ReadonlySet<string>;
    canBlockUsers: (id: GroupChatIdentifier | CommunityIdentifier) => boolean;
};

const none: ProfileBlock = { kind: "none" };

/**
 * Blocking from a profile acts where the card was opened: the DM for a DM, the group for a group,
 * the community for a channel or community. Never for yourself or from a global context.
 */
export function profileBlock(input: ProfileBlockInput): ProfileBlock {
    const { userId, chat, community } = input;
    if (input.isMe || input.inGlobalContext) return none;

    if (chat?.kind === "direct_chat") {
        return {
            kind: input.blockedUsers.has(userId) ? "unblock" : "block",
            context: { kind: "direct_chat" },
        };
    }
    if (chat?.kind === "group_chat") {
        if (!input.canBlockUsers(chat.id)) return none;
        return {
            kind: input.blockedChatUsers.has(userId) ? "unblock" : "block",
            context: { kind: "group_chat", id: chat.id },
        };
    }
    if (community !== undefined) {
        if (!input.canBlockUsers(community.id)) return none;
        return {
            kind: input.blockedCommunityUsers.has(userId) ? "unblock" : "block",
            context: { kind: "community", id: community.id },
        };
    }
    return none;
}

export type BlockOutcome =
    | { kind: "success"; message: ResourceKey }
    | { kind: "failed"; message: ResourceKey };

/** The toast for a block or unblock that succeeded or failed. */
export function blockOutcome(blocking: boolean, success: boolean): BlockOutcome {
    const action = blocking ? "block" : "unblock";
    return success
        ? { kind: "success", message: i18nKey(`${action}UserSucceeded`) }
        : { kind: "failed", message: i18nKey(`${action}UserFailed`) };
}
