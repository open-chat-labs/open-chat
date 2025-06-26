/* eslint-disable no-case-declarations */
import {
    chatIdentifiersEqual,
    toBigInt64,
    type ChatIdentifier,
    type ChatSummary,
    type CommunityIdentifier,
    type MessageContent,
    type RemoteVideoCallStarted,
    type WebRtcMessage,
} from "openchat-shared";
import { get } from "svelte/store";
import {
    blockedUsersStore,
    selectedChatSummaryStore,
    serverCommunitiesStore,
    serverDirectChatsStore,
    serverGroupChatsStore,
} from "../state";

export function messageIsForSelectedChat(msg: WebRtcMessage): boolean {
    const chat = findChatByChatType(msg);
    if (chat === undefined) return false;
    const selectedChat = get(selectedChatSummaryStore);
    if (selectedChat === undefined) return false;
    if (chat.id !== selectedChat.id) return false;
    return true;
}

export function createRemoteVideoStartedEvent(msg: RemoteVideoCallStarted) {
    const chat = findChatByChatType(msg);
    if (chat) {
        return {
            chatId: chat.id,
            userId: msg.userId,
            messageId: msg.messageId,
            currentUserIsParticipant: false,
            callType: msg.callType,
            timestamp: BigInt(Date.now()),
        };
    }
}

function findChatByChatType(msg: WebRtcMessage): ChatSummary | undefined {
    switch (msg.id.kind) {
        case "direct_chat":
            return get(serverDirectChatsStore).get({ kind: "direct_chat", userId: msg.userId });
        case "group_chat":
            return get(serverGroupChatsStore).get(msg.id);
        case "channel":
            const communityId: CommunityIdentifier = {
                kind: "community",
                communityId: msg.id.communityId,
            };
            const channels = get(serverCommunitiesStore).get(communityId)?.channels ?? [];
            const channelId = msg.id.channelId;
            return channels.find((c) => c.id.channelId === channelId);
    }
}

function isDirectChatWith(chat: ChatSummary, userId: string): boolean {
    return chat.kind === "direct_chat" && chat.them.userId === userId;
}

function isBlockedUser(chat: ChatSummary): boolean {
    return chat.kind === "direct_chat" && get(blockedUsersStore).has(chat.them.userId);
}

export function filterWebRtcMessage(msg: WebRtcMessage): ChatIdentifier | undefined {
    const fromChat = findChatByChatType(msg);
    const selectedChat = get(selectedChatSummaryStore);

    // if the chat can't be found - ignore
    if (fromChat === undefined || selectedChat === undefined) {
        return undefined;
    }

    if (
        chatIdentifiersEqual(fromChat.id, selectedChat.id) &&
        isDirectChatWith(selectedChat, msg.userId) &&
        isBlockedUser(selectedChat)
    ) {
        console.log("ignoring webrtc message from blocked user");
        return undefined;
    }

    return fromChat.id;
}

function hydrateBigIntsInContent(content: MessageContent): MessageContent {
    if (content.kind === "crypto_content") {
        if (content.transfer.kind === "pending") {
            return {
                ...content,
                transfer: {
                    ...content.transfer,
                    amountE8s: BigInt(content.transfer.amountE8s),
                    feeE8s:
                        content.transfer.feeE8s !== undefined
                            ? BigInt(content.transfer.feeE8s)
                            : undefined,
                },
            };
        }
        if (content.transfer.kind === "completed") {
            return {
                ...content,
                transfer: {
                    ...content.transfer,
                    amountE8s: BigInt(content.transfer.amountE8s),
                    feeE8s: BigInt(content.transfer.feeE8s),
                    blockIndex: BigInt(content.transfer.blockIndex),
                },
            };
        }
    }
    return content;
}

/**
 * This is just here to cast various bits to bigint - it sucks but it appears to be necessary
 */
export function parseWebRtcMessage(chatId: ChatIdentifier, msg: WebRtcMessage): WebRtcMessage {
    if (
        msg.kind === "remote_user_read_message" ||
        msg.kind === "remote_user_toggled_reaction" ||
        msg.kind === "remote_user_deleted_message" ||
        msg.kind === "remote_user_removed_message"
    ) {
        return {
            ...msg,
            id: chatId,
            messageId: toBigInt64(msg.messageId),
        };
    }
    if (msg.kind === "remote_user_sent_message") {
        msg.message.content = hydrateBigIntsInContent(msg.message.content);
        if (msg.message.repliesTo?.kind === "rehydrated_reply_context") {
            msg.message.repliesTo = {
                ...msg.message.repliesTo,
                messageId: toBigInt64(msg.message.repliesTo.messageId),
                content: hydrateBigIntsInContent(msg.message.repliesTo.content),
            };
        }
        return {
            ...msg,
            id: chatId,
            message: {
                ...msg.message,
                messageId: toBigInt64(msg.message.messageId),
                timestamp: BigInt(Date.now()),
            },
        };
    }
    return msg;
}
