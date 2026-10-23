import type {
    ChatEvent,
    ChatSummary,
    EventWrapper,
    Message,
    RightPanelContent,
    RightPanelView,
} from "@shared";

export type RightPanelInput = {
    /** The last `rightPanelHistory` entry (`lastRightPanelState`). */
    panel: RightPanelContent;
    /** The selected chat's kind, if one is selected. */
    chatKind: ChatSummary["kind"] | undefined;
    /** Whether a community is selected. */
    inCommunity: boolean;
    /** The selected chat's events, where a thread's root message is looked for. */
    events: EventWrapper<ChatEvent>[];
};

/**
 * What the right panel shows. An entry that doesn't fit the selected chat shows nothing, and a
 * thread shows once its root message is in the chat's events.
 */
export function rightPanelView({
    panel,
    chatKind,
    inCommunity,
    events,
}: RightPanelInput): RightPanelView {
    const none: RightPanelView = { kind: "none" };
    const channel = chatKind === "channel" && inCommunity;
    const multiUser = chatKind === "group_chat" || chatKind === "channel";

    switch (panel.kind) {
        case "group_details":
            if (channel) return { kind: "channel_summary", tab: "channel" };
            if (chatKind === "group_chat") return { kind: "group_details" };
            if (chatKind === "direct_chat") return { kind: "direct_chat_details" };
            return none;
        case "community_details":
            if (!inCommunity) return none;
            return channel
                ? { kind: "channel_summary", tab: "community" }
                : { kind: "community_details" };
        case "show_group_members":
            if (chatKind === "group_chat") return { kind: "group_members" };
            if (channel) return { kind: "channel_or_community_members", tab: "channel" };
            return none;
        case "show_community_members":
            if (!inCommunity) return none;
            return channel
                ? { kind: "channel_or_community_members", tab: "community" }
                : { kind: "community_members", userGroupId: panel.userGroupId };
        case "invite_group_users":
            if (!multiUser) return none;
            if (channel) return { kind: "channel_or_community_invite", tab: "channel" };
            return { kind: "invite_users", level: chatKind === "channel" ? "channel" : "group" };
        case "invite_community_users":
            if (!inCommunity) return none;
            return channel
                ? { kind: "channel_or_community_invite", tab: "community" }
                : { kind: "invite_users", level: "community" };
        case "show_pinned":
            return multiUser ? { kind: "pinned" } : none;
        case "proposal_filters":
            return multiUser ? { kind: "proposal_filters" } : none;
        case "message_thread_panel": {
            if (chatKind === undefined) return none;
            const rootEvent = findMessage(events, panel.threadRootMessageId);
            return rootEvent === undefined ? none : { kind: "thread", rootEvent };
        }
        case "user_profile":
            return { kind: "user_profile" };
        case "community_filters":
            return { kind: "community_filters" };
        case "call_participants_panel":
            return {
                kind: "call_participants",
                chatId: panel.chatId,
                messageId: panel.messageId,
                isOwner: panel.isOwner,
            };
        case "no_panel":
            return none;
    }
}

function findMessage(
    events: EventWrapper<ChatEvent>[],
    messageId: bigint,
): EventWrapper<Message> | undefined {
    return events.find(
        (e): e is EventWrapper<Message> =>
            e.event.kind === "message" && e.event.messageId === messageId,
    );
}
