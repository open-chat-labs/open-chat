import type { EventWrapper, Message } from "../chat/chat";

export type WebRtcSessionDetails = WebRtcOffer | WebRtcAnswer;

export type WebRtcOffer = {
    kind: "offer";
    fromUserId: string;
    endpoint: WebRtcEndpoint;
};

export type WebRtcAnswer = {
    kind: "answer";
    offerId: string;
    fromUserId: string;
    endpoint: WebRtcEndpoint;
};

export type WebRtcEndpoint = {
    id: string;
    connectionString: string;
    iceCandidates: string[];
};

export type WebRtcSessionDetailsEvent = {
    sessionDetails: WebRtcSessionDetails;
    timestamp: bigint;
    chatId: string; //we need to add this so that we have a way to figure out where to send answers
};

export type WebRtcMessage =
    | RemoteUserStoppedTyping
    | RemoteUserTyping
    | RemoteUserToggledReaction
    | RemoteUserDeletedMessage
    | RemoteUserSentMessage
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

export type RemoteUserSentMessage = {
    kind: "remote_user_sent_message";
    chatId: string;
    messageEvent: EventWrapper<Message>;
    userId: string;
};

export type AddWebRtcResponse = "success" | "blocked";
