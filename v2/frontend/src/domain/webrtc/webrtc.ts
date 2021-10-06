import type { EventWrapper, Message } from "../chat/chat";

export type WebRtcMessage =
    | RemoteUserStoppedTyping
    | RemoteUserTyping
    | RemoteUserToggledReaction
    | RemoteUserDeletedMessage
    | RemoteUserSentMessage
    | RemoteUserReadMessage
    | RemoteUserRemovedMessage
    | RemoteUserUndeletedMessage;

export type CurrentUserTyping = {
    kind: "current_user_typing";
    chatId: string;
};

export type CurrentUserStoppedTyping = {
    kind: "current_user_stopped_typing";
    chatId: string;
};

export type RemoteUserTyping = {
    kind: "remote_user_typing";
    chatId: string;
    userId: string;
};

export type RemoteUserStoppedTyping = {
    kind: "remote_user_stopped_typing";
    chatId: string;
    userId: string;
};

export type RemoteUserToggledReaction = {
    kind: "remote_user_toggled_reaction";
    chatId: string;
    messageId: bigint;
    userId: string;
    reaction: string;
};

export type RemoteUserRemovedMessage = {
    kind: "remote_user_removed_message";
    chatId: string;
    messageId: bigint;
    userId: string;
};

export type RemoteUserDeletedMessage = {
    kind: "remote_user_deleted_message";
    chatId: string;
    messageId: bigint;
    userId: string;
};

export type RemoteUserUndeletedMessage = {
    kind: "remote_user_undeleted_message";
    chatId: string;
    message: Message;
    userId: string;
};

export type RemoteUserReadMessage = {
    kind: "remote_user_read_message";
    chatId: string;
    messageId: bigint;
    messageIndex?: number;
    userId: string;
};

export type RemoteUserSentMessage = {
    kind: "remote_user_sent_message";
    chatId: string;
    messageEvent: EventWrapper<Message>;
    userId: string;
};
