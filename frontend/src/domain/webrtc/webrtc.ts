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

type WebRtcMessageCommon = {
    chatType: "direct_chat" | "group_chat";
    chatId: string;
    userId: string;
};

export type CurrentUserTyping = WebRtcMessageCommon & {
    kind: "current_user_typing";
};

export type CurrentUserStoppedTyping = WebRtcMessageCommon & {
    kind: "current_user_stopped_typing";
};

export type RemoteUserTyping = WebRtcMessageCommon & {
    kind: "remote_user_typing";
};

export type RemoteUserStoppedTyping = WebRtcMessageCommon & {
    kind: "remote_user_stopped_typing";
};

export type RemoteUserToggledReaction = WebRtcMessageCommon & {
    kind: "remote_user_toggled_reaction";
    messageId: bigint;
    reaction: string;
};

export type RemoteUserRemovedMessage = WebRtcMessageCommon & {
    kind: "remote_user_removed_message";
    messageId: bigint;
};

export type RemoteUserDeletedMessage = WebRtcMessageCommon & {
    kind: "remote_user_deleted_message";
    messageId: bigint;
};

export type RemoteUserUndeletedMessage = WebRtcMessageCommon & {
    kind: "remote_user_undeleted_message";
    message: Message;
};

export type RemoteUserReadMessage = WebRtcMessageCommon & {
    kind: "remote_user_read_message";
    messageId: bigint;
};

export type RemoteUserSentMessage = WebRtcMessageCommon & {
    kind: "remote_user_sent_message";
    messageEvent: EventWrapper<Message>;
};
