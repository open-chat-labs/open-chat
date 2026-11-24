import type { ChatSummary, CommunityIdentifier, MessageContext } from "@client";

export type ChatNameLookups = {
    /** A DM's other user, as the app names them. */
    displayName: (userId: string) => string;
    /** A community's name, if it's loaded. */
    communityName: (id: CommunityIdentifier) => string | undefined;
    /** "Thread", in the app's language, added for a message in a thread. */
    thread: string;
};

/**
 * Where an activity happened, as the old feeds name it (`getChatName` in both trees'
 * ActivityEvent): the person for a DM, the group's name, or "Community > channel" (the channel
 * alone while its community isn't loaded), then "> Thread" for a message in a thread. Nothing when
 * the chat's summary isn't loaded. The web's feed and the native Activity tab both use it.
 */
export function activityChatName(
    chat: ChatSummary | undefined,
    context: MessageContext,
    { displayName, communityName, thread }: ChatNameLookups,
): string | undefined {
    if (chat === undefined) return undefined;
    const parts: string[] = [];
    switch (chat.kind) {
        case "direct_chat":
            parts.push(displayName(chat.them.userId));
            break;
        case "group_chat":
            parts.push(chat.name);
            break;
        case "channel": {
            const community = communityName({
                kind: "community",
                communityId: chat.id.communityId,
            });
            if (community !== undefined) parts.push(community);
            parts.push(chat.name);
            break;
        }
    }
    if (context.threadRootMessageIndex !== undefined) parts.push(thread);
    return parts.join(" > ");
}
