import type { ChatSummary, DirectChatSummary, MessageContent } from "../domain/chat/chat";
import { chatSummariesListStore, chatSummariesStore, selectedChatStore } from "../stores/chat";
import { get } from "svelte/store";
import type { WebRtcMessage } from "../domain/webrtc/webrtc";
import { blockedUsers } from "../stores/blockedUsers";

export function delegateToChatComponent(msg: WebRtcMessage): boolean {
    const chat = findChatByChatType(msg);
    if (chat === undefined) return false;
    const selectedChat = get(selectedChatStore);
    if (selectedChat === undefined) return false;
    if (chat.chatId !== selectedChat.chatId) return false;
    return true;
}

function findDirectChatByUserId(userId: string): DirectChatSummary | undefined {
    return get(chatSummariesListStore).find(
        (c) => c.kind === "direct_chat" && c.them === userId
    ) as DirectChatSummary | undefined;
}

function findChatById(chatId: string): ChatSummary | undefined {
    return get(chatSummariesStore)[chatId];
}

function findChatByChatType(msg: WebRtcMessage): ChatSummary | undefined {
    return msg.chatType === "group_chat"
        ? findChatById(msg.chatId)
        : findDirectChatByUserId(msg.userId);
}

function isDirectChatWith(chat: ChatSummary, userId: string): boolean {
    return chat.kind === "direct_chat" && chat.them === userId;
}

function isBlockedUser(chat: ChatSummary): boolean {
    return chat.kind === "direct_chat" && get(blockedUsers).has(chat.them);
}

export function filterWebRtcMessage(msg: WebRtcMessage): string | undefined {
    const fromChat = findChatByChatType(msg);
    const selectedChat = get(selectedChatStore);

    // if the chat can't be found - ignore
    if (fromChat === undefined || selectedChat === undefined) {
        return undefined;
    }

    if (
        fromChat.chatId === selectedChat.chatId &&
        isDirectChatWith(selectedChat, msg.userId) &&
        isBlockedUser(selectedChat)
    ) {
        console.log("ignoring webrtc message from blocked user");
        return undefined;
    }

    return fromChat.chatId;
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
                    memo:
                        content.transfer.memo !== undefined
                            ? BigInt(content.transfer.memo)
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
                    memo: BigInt(content.transfer.memo),
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
export function parseWebRtcMessage(chatId: string, msg: WebRtcMessage): WebRtcMessage {
    if (
        msg.kind === "remote_user_read_message" ||
        msg.kind === "remote_user_toggled_reaction" ||
        msg.kind === "remote_user_deleted_message" ||
        msg.kind === "remote_user_removed_message"
    ) {
        return {
            ...msg,
            chatId,
            messageId: BigInt(msg.messageId),
        };
    }
    if (msg.kind === "remote_user_sent_message") {
        msg.messageEvent.event.content = hydrateBigIntsInContent(msg.messageEvent.event.content);
        if (msg.messageEvent.event.repliesTo?.kind === "rehydrated_reply_context") {
            msg.messageEvent.event.repliesTo = {
                ...msg.messageEvent.event.repliesTo,
                messageId: BigInt(msg.messageEvent.event.messageId),
                content: hydrateBigIntsInContent(msg.messageEvent.event.repliesTo.content),
            };
        }
        return {
            ...msg,
            chatId,
            messageEvent: {
                ...msg.messageEvent,
                event: {
                    ...msg.messageEvent.event,
                    messageId: BigInt(msg.messageEvent.event.messageId),
                },
                timestamp: BigInt(Date.now()),
            },
        };
    }
    return msg;
}
