import {
    chatIdentifiersEqual,
    type ChatIdentifier,
    type ChatSummary,
    type MessageContent,
    type WebRtcMessage,
} from "openchat-shared";
import { selectedChatStore } from "../stores/chat";
import { get } from "svelte/store";
import { blockedUsers } from "../stores/blockedUsers";
import { globalStateStore } from "src/stores/global";

export function messageIsForSelectedChat(msg: WebRtcMessage): boolean {
    const chat = findChatByChatType(msg);
    if (chat === undefined) return false;
    const selectedChat = get(selectedChatStore);
    if (selectedChat === undefined) return false;
    if (chat.id !== selectedChat.id) return false;
    return true;
}

function findChatByChatType(msg: WebRtcMessage): ChatSummary | undefined {
    const state = get(globalStateStore);
    if (msg.id.kind === "direct_chat") {
        return state.directChats.get({ kind: "direct_chat", userId: msg.userId });
    } else {
        return state.groupChats.get(msg.id);
    }
}

function isDirectChatWith(chat: ChatSummary, userId: string): boolean {
    return chat.kind === "direct_chat" && chat.them.userId === userId;
}

function isBlockedUser(chat: ChatSummary): boolean {
    return chat.kind === "direct_chat" && get(blockedUsers).has(chat.them.userId);
}

export function filterWebRtcMessage(msg: WebRtcMessage): ChatIdentifier | undefined {
    const fromChat = findChatByChatType(msg);
    const selectedChat = get(selectedChatStore);

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
            id: chatId,
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
