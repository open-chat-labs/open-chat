import type { ChatSummary, DirectChatSummary, MessageContent } from "../chat/chat";
import type { ChatController } from "../../fsm/chat.controller";
import { chatSummariesListStore, chatSummariesStore, selectedChatStore } from "../../stores/chat";
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
import type { ServiceContainer } from "../../services/serviceContainer";
import { toggleReactionInEventList } from "../../stores/reactions";

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

function remoteUserToggledReaction(message: RemoteUserToggledReaction): void {
    delegateToChatController(message, (chat) =>
        chat.events.update((events) =>
            toggleReactionInEventList(
                chat.chatVal,
                message.userId,
                events,
                message.messageId,
                message.reaction,
                chat.chatUserIds,
                chat.user.userId
            )
        )
    );
}
function remoteUserDeletedMessage(message: RemoteUserDeletedMessage): void {
    delegateToChatController(message, (chat) =>
        chat.deleteMessage(message.messageId, message.userId)
    );
}

function remoteUserUndeletedMessage(message: RemoteUserUndeletedMessage): void {
    delegateToChatController(message, (chat) =>
        chat.undeleteMessage(message.message, message.userId)
    );
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

function delegateToChatController(
    msg: WebRtcMessage,
    fn: (selectedChat: ChatController) => void
): boolean {
    const chat = findChatByChatType(msg);
    if (chat === undefined) return false;
    const selectedChat = get(selectedChatStore);
    if (selectedChat === undefined) return false;
    if (chat.chatId !== selectedChat.chatId) return false;
    fn(selectedChat);
    return true;
}

export function handleWebRtcMessage(message: unknown): void {
    const parsedMsg = message as WebRtcMessage;

    const fromChat = findChatByChatType(parsedMsg);
    const selectedChat = get(selectedChatStore);

    // if the chat can't be found - ignore
    if (fromChat === undefined) {
        return;
    }

    if (
        fromChat.chatId === selectedChat?.chatId &&
        selectedChat?.isDirectChatWith(parsedMsg.userId) &&
        selectedChat?.isBlockedUser()
    ) {
        console.log("ignoring webrtc message from blocked user");
        return;
    }

    if (parsedMsg.kind === "remote_user_typing") {
        typing.add(fromChat.chatId, parsedMsg.userId);
    }
    if (parsedMsg.kind === "remote_user_stopped_typing") {
        typing.delete(fromChat.chatId, parsedMsg.userId);
    }
    if (parsedMsg.kind === "remote_user_toggled_reaction") {
        remoteUserToggledReaction({
            ...parsedMsg,
            chatId: fromChat.chatId,
            messageId: BigInt(parsedMsg.messageId),
        });
    }
    if (parsedMsg.kind === "remote_user_deleted_message") {
        remoteUserDeletedMessage({
            ...parsedMsg,
            chatId: fromChat.chatId,
            messageId: BigInt(parsedMsg.messageId),
        });
    }
    if (parsedMsg.kind === "remote_user_removed_message") {
        remoteUserRemovedMessage({
            ...parsedMsg,
            chatId: fromChat.chatId,
            messageId: BigInt(parsedMsg.messageId),
        });
    }
    if (parsedMsg.kind === "remote_user_undeleted_message") {
        remoteUserUndeletedMessage(parsedMsg);
    }
    if (parsedMsg.kind === "remote_user_sent_message") {
        parsedMsg.messageEvent.event.content = hydrateBigIntsInContent(
            parsedMsg.messageEvent.event.content
        );
        if (parsedMsg.messageEvent.event.repliesTo?.kind === "rehydrated_reply_context") {
            parsedMsg.messageEvent.event.repliesTo = {
                ...parsedMsg.messageEvent.event.repliesTo,
                messageId: BigInt(parsedMsg.messageEvent.event.messageId),
                content: hydrateBigIntsInContent(parsedMsg.messageEvent.event.repliesTo.content),
            };
        }
        remoteUserSentMessage({
            ...parsedMsg,
            chatId: fromChat.chatId,
            messageEvent: {
                ...parsedMsg.messageEvent,
                event: {
                    ...parsedMsg.messageEvent.event,
                    messageId: BigInt(parsedMsg.messageEvent.event.messageId),
                },
                timestamp: BigInt(Date.now()),
            },
        });
    }
    if (parsedMsg.kind === "remote_user_read_message") {
        remoteUserReadMessage({
            ...parsedMsg,
            chatId: fromChat.chatId,
            messageId: BigInt(parsedMsg.messageId),
        });
    }
}
