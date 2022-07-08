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
import { toggleReactionInEventList } from "../../stores/reactions";
import { hydrateBigIntsInContent } from "../../domain/chat/chat.utils";

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
    const selectedChat = get(selectedChatStore);

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

export function handleWebRtcMessage(msg: WebRtcMessage): void {
    const chatId = filterWebRtcMessage(msg);
    if (chatId === undefined) return;

    if (msg.kind === "remote_user_typing") {
        typing.startTyping(chatId, msg.userId, msg.threadRootMessageIndex);
    }
    if (msg.kind === "remote_user_stopped_typing") {
        typing.stopTyping(msg.userId);
    }
    if (msg.kind === "remote_user_toggled_reaction") {
        remoteUserToggledReaction({
            ...msg,
            chatId,
            messageId: BigInt(msg.messageId),
        });
    }
    if (msg.kind === "remote_user_deleted_message") {
        remoteUserDeletedMessage({
            ...msg,
            chatId,
            messageId: BigInt(msg.messageId),
        });
    }
    if (msg.kind === "remote_user_removed_message") {
        remoteUserRemovedMessage({
            ...msg,
            chatId,
            messageId: BigInt(msg.messageId),
        });
    }
    if (msg.kind === "remote_user_undeleted_message") {
        remoteUserUndeletedMessage(msg);
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
        remoteUserSentMessage({
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
        });
    }
    if (msg.kind === "remote_user_read_message") {
        remoteUserReadMessage({
            ...msg,
            chatId,
            messageId: BigInt(msg.messageId),
        });
    }
}
