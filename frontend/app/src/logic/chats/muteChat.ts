import {
    muteNotificationsFailureMessage,
    type ChatIdentifier,
    type MessageFormatter,
    type OpenChat,
    type ResourceKey,
} from "@client";

/**
 * Mutes or unmutes a chat's notifications (`mute`) or its @everyone (`muteAtEveryone`); resolves
 * to the message to show if it failed.
 */
export async function muteChat(
    client: OpenChat,
    chatId: ChatIdentifier,
    mute: boolean | undefined,
    muteAtEveryone: boolean | undefined,
    formatter: MessageFormatter,
): Promise<ResourceKey | undefined> {
    const success = await client.toggleMuteNotifications(chatId, mute, muteAtEveryone);
    return success ? undefined : muteNotificationsFailureMessage(mute, muteAtEveryone, formatter);
}
