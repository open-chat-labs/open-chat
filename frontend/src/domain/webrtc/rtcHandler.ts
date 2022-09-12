import type { ChatSummary, DirectChatSummary, MessageContent } from "../chat/chat";
import type { ChatController } from "../../fsm/chat.controller";
import {
    chatSummariesListStore,
    chatSummariesStore,
    selectedChatControllerStore,
} from "../../stores/chat";
import { typing } from "../../stores/typing";
import { unconfirmed, unconfirmedReadByThem } from "../../stores/unconfirmed";
import { get } from "svelte/store";
import type {
    RemoteUserDeletedMessage,
    RemoteUserReadMessage,
    RemoteUserRemovedMessage,
    RemoteUserSentMessage,
    RemoteUserToggledReaction,
    RemoteUserUndeletedMessage,
    WebRtcMessage,
} from "./webrtc";
import { eventsStore } from "../../stores/chat";
import { containsReaction, findMessageById } from "domain/chat/chat.utils";
import { localMessageUpdates } from "stores/localMessageUpdates";

function remoteUserToggledReaction(message: RemoteUserToggledReaction): void {
    const matchingMessage = findMessageById(message.messageId, get(eventsStore));

    if (matchingMessage !== undefined) {
        const exists = containsReaction(
            message.userId,
            message.reaction,
            matchingMessage.event.reactions
        );

        localMessageUpdates.markReaction(message.messageId.toString(), {
            reaction: message.reaction,
            kind: exists ? "remove" : "add",
            userId: message.userId,
        });
    }
}
function remoteUserDeletedMessage(message: RemoteUserDeletedMessage): void {
    localMessageUpdates.markDeleted(message.messageId.toString(), message.userId);
}

function remoteUserUndeletedMessage(message: RemoteUserUndeletedMessage): void {
    localMessageUpdates.markUndeleted(message.messageId.toString());
}

function remoteUserRemovedMessage(message: RemoteUserRemovedMessage): void {
    delegateToChatController(message, (chat) =>
        chat.removeMessage(message.messageId, message.userId)
    );
}

function remoteUserSentMessage(message: RemoteUserSentMessage): void {
    console.log("remote user sent message");
    if (
        !delegateToChatController(message, (chat) =>
            chat.handleMessageSentByOther(message.messageEvent, false)
        )
    ) {
        unconfirmed.add(message.chatId, message.messageEvent);
    }
}

function remoteUserReadMessage(message: RemoteUserReadMessage): void {
    unconfirmedReadByThem.add(BigInt(message.messageId));
}

function delegateToChatController(
    msg: WebRtcMessage,
    fn: (selectedChat: ChatController) => void
): boolean {
    const chat = findChatByChatType(msg);
    if (chat === undefined) return false;
    const selectedChat = get(selectedChatControllerStore);
    if (selectedChat === undefined) return false;
    if (chat.chatId !== selectedChat.chatId) return false;
    fn(selectedChat);
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

export function filterWebRtcMessage(msg: WebRtcMessage): string | undefined {
    const fromChat = findChatByChatType(msg);
    const selectedChat = get(selectedChatControllerStore);

    // if the chat can't be found - ignore
    if (fromChat === undefined) {
        return undefined;
    }

    if (
        fromChat.chatId === selectedChat?.chatId &&
        selectedChat?.isDirectChatWith(msg.userId) &&
        selectedChat?.isBlockedUser()
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

export function handleWebRtcMessage(msg: WebRtcMessage): void {
    const chatId = filterWebRtcMessage(msg);
    if (chatId === undefined) return;
    const parsed = parseWebRtcMessage(chatId, msg);
    const { kind } = parsed;

    if (kind === "remote_user_typing") {
        typing.startTyping(chatId, parsed.userId, parsed.threadRootMessageIndex);
    }
    if (kind === "remote_user_stopped_typing") {
        typing.stopTyping(msg.userId);
    }
    if (kind === "remote_user_toggled_reaction") {
        remoteUserToggledReaction(parsed);
    }
    if (kind === "remote_user_deleted_message") {
        remoteUserDeletedMessage(parsed);
    }
    if (kind === "remote_user_removed_message") {
        remoteUserRemovedMessage(parsed);
    }
    if (kind === "remote_user_undeleted_message") {
        remoteUserUndeletedMessage(parsed);
    }
    if (kind === "remote_user_sent_message") {
        remoteUserSentMessage(parsed);
    }
    if (kind === "remote_user_read_message") {
        remoteUserReadMessage(parsed);
    }
}
