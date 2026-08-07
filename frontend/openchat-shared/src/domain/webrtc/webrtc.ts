import { type Static, Type } from "@sinclair/typebox";
import { ChatIdentifierSchema, type NewUnconfirmedMessage, VideoCallTypeSchema } from "../chat/chat";

export type WebRtcMessage =
    | RemoteUserStoppedTyping
    | RemoteUserTyping
    | RemoteUserToggledReaction
    | RemoteUserDeletedMessage
    | RemoteUserSentMessage
    | RemoteUserReadMessage
    | RemoteUserRemovedMessage
    | RemoteUserUndeletedMessage
    | RemoteVideoCallStarted
    | RemoteVideoCallEnded;

export const WebRtcMessageCommonSchema = Type.Object({
    id: ChatIdentifierSchema,
    userId: Type.String(),
    threadRootMessageIndex: Type.Optional(Type.Number()),
})
export type WebRtcMessageCommon = Static<typeof WebRtcMessageCommonSchema>;

const RemoteVideoCallStartedSchema = Type.Intersect([WebRtcMessageCommonSchema, Type.Object({
    kind: Type.Literal("remote_video_call_started"),
    messageId: Type.BigInt(),
    callType: VideoCallTypeSchema,
})]);
export type RemoteVideoCallStarted = Static<typeof RemoteVideoCallStartedSchema>;

const RemoteVideoCallEndedSchema = Type.Intersect([WebRtcMessageCommonSchema, Type.Object({
    kind: Type.Literal("remote_video_call_ended"),
    messageId: Type.BigInt(),
})]);
export type RemoteVideoCallEnded = Static<typeof RemoteVideoCallEndedSchema>;

const CurrentUserTypingSchema = Type.Intersect([WebRtcMessageCommonSchema, Type.Object({
    kind: Type.Literal("current_user_typing"),
})]);
export type CurrentUserTyping = Static<typeof CurrentUserTypingSchema>;

const CurrentUserStoppedTypingSchema = Type.Intersect([WebRtcMessageCommonSchema, Type.Object({
    kind: Type.Literal("current_user_stopped_typing"),
})]);
export type CurrentUserStoppedTyping = Static<typeof CurrentUserStoppedTypingSchema>;

const RemoteUserTypingSchema = Type.Intersect([WebRtcMessageCommonSchema, Type.Object({
    kind: Type.Literal("remote_user_typing"),
})]);
export type RemoteUserTyping = Static<typeof RemoteUserTypingSchema>;

const RemoteUserStoppedTypingSchema = Type.Intersect([WebRtcMessageCommonSchema, Type.Object({
    kind: Type.Literal("remote_user_stopped_typing"),
})]);
export type RemoteUserStoppedTyping = Static<typeof RemoteUserStoppedTypingSchema>;

const RemoteUserToggledReactionSchema = Type.Intersect([WebRtcMessageCommonSchema, Type.Object({
    kind: Type.Literal("remote_user_toggled_reaction"),
    messageId: Type.BigInt(),
    reaction: Type.String(),
    added: Type.Boolean(),
})]);
export type RemoteUserToggledReaction = Static<typeof RemoteUserToggledReactionSchema>;

const RemoteUserRemovedMessageSchema = Type.Intersect([WebRtcMessageCommonSchema, Type.Object({
    kind: Type.Literal("remote_user_removed_message"),
    messageId: Type.BigInt(),
})]);
export type RemoteUserRemovedMessage = Static<typeof RemoteUserRemovedMessageSchema>;

const RemoteUserDeletedMessageSchema = Type.Intersect([WebRtcMessageCommonSchema, Type.Object({
    kind: Type.Literal("remote_user_deleted_message"),
    messageId: Type.BigInt(),
})]);
export type RemoteUserDeletedMessage = Static<typeof RemoteUserDeletedMessageSchema>;

const RemoteUserUndeletedMessageSchema = Type.Intersect([WebRtcMessageCommonSchema, Type.Object({
    kind: Type.Literal("remote_user_undeleted_message"),
    messageId: Type.BigInt(),
})]);
export type RemoteUserUndeletedMessage = Static<typeof RemoteUserUndeletedMessageSchema>;

const RemoteUserReadMessageSchema = Type.Intersect([WebRtcMessageCommonSchema, Type.Object({
    kind: Type.Literal("remote_user_read_message"),
    messageId: Type.BigInt(),
})]);
export type RemoteUserReadMessage = Static<typeof RemoteUserReadMessageSchema>;

export type RemoteUserSentMessage = WebRtcMessageCommon & {
    kind: "remote_user_sent_message";
    message: NewUnconfirmedMessage;
};
