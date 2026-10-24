import {
    chatIdentifiersEqual,
    type ChatSummary,
    type CommunityIdentifier,
    type CommunitySummary,
    type MultiUserChat,
    type MultiUserChatIdentifier,
} from "@client";

/**
 * The group, channel or community a dialog was opened for, while it's still the one selected
 * (another being opened navigates, which closes the dialog).
 */
export function dialogTarget(
    id: MultiUserChatIdentifier | CommunityIdentifier,
    chat: ChatSummary | undefined,
    community: CommunitySummary | undefined,
): MultiUserChat | CommunitySummary | undefined {
    if (id.kind === "community") {
        return community?.id.communityId === id.communityId ? community : undefined;
    }
    return (chat?.kind === "group_chat" || chat?.kind === "channel") &&
        chatIdentifiersEqual(chat.id, id)
        ? chat
        : undefined;
}
