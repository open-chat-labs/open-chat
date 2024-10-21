import { UnsupportedValueError } from "openchat-shared";

export function mapCommonResponsesKind(
    value: CommonCanisterResponse,
    name: string,
): { kind: CommonResponse } {
    const kind = mapCommonResponses(value, name);
    return { kind };
}

export function mapCommonResponses(value: CommonCanisterResponse, name: string): CommonResponse {
    if (typeof value === "string") {
        switch (value) {
            case "Success":
            case "SuccessV2":
                return "success";
            case "SuccessNoUpdates":
                return "success_no_updates";
            case "AlreadyEnded":
                return "already_ended";
            case "CallerNotInGroup":
                return "caller_not_in_group";
            case "ChannelNotFound":
                return "channel_not_found";
            case "ChatFrozen":
                return "chat_frozen";
            case "ChatNotFound":
                return "chat_not_found";
            case "CommunityFrozen":
                return "community_frozen";
            case "CommunityPublic":
                return "community_public";
            case "GroupFrozen":
                return "group_frozen";
            case "GroupNotPublic":
                return "group_not_public";
            case "InternalError":
                return "internal_error";
            case "Invalid":
                return "invalid";
            case "MessageNotFound":
                return "message_not_found";
            case "NotAuthorized":
                return "not_authorized";
            case "ThreadMessageNotFound":
                return "thread_message_not_found";
            case "ThreadNotFound":
                return "thread_not_found";
            case "UserLapsed":
                return "user_lapsed";
            case "UserNotFound":
                return "user_not_found";
            case "UserNotInChannel":
                return "user_not_in_channel";
            case "UserNotInCommunity":
                return "user_not_in_community";
            case "UserNotInGroup":
                return "user_not_in_group";
            case "UserSuspended":
                return "user_suspended";
        }
    } else if (typeof value === "object") {
        if ("InternalError" in value) {
            return "internal_error";
        }
    }
    throw new UnsupportedValueError(`Unexpected ${name} type received`, value);
}

export type CommonCanisterResponse =
    | "Success"
    | "SuccessV2"
    | "SuccessNoUpdates"
    | "AlreadyEnded"
    | "CallerNotInGroup"
    | "ChannelNotFound"
    | "ChatFrozen"
    | "ChatNotFound"
    | "CommunityFrozen"
    | "CommunityPublic"
    | "GroupFrozen"
    | "GroupNotPublic"
    | "InternalError"
    | "Invalid"
    | "MessageNotFound"
    | "NotAuthorized"
    | "ThreadMessageNotFound"
    | "ThreadNotFound"
    | "UserLapsed"
    | "UserNotFound"
    | "UserNotInChannel"
    | "UserNotInCommunity"
    | "UserNotInGroup"
    | "UserSuspended"
    | { InternalError: string };

export type CommonResponse =
    | "success"
    | "success_no_updates"
    | "already_ended"
    | "caller_not_in_group"
    | "channel_not_found"
    | "chat_frozen"
    | "chat_not_found"
    | "community_frozen"
    | "community_public"
    | "group_frozen"
    | "group_not_public"
    | "internal_error"
    | "invalid"
    | "message_not_found"
    | "not_authorized"
    | "thread_message_not_found"
    | "thread_not_found"
    | "user_lapsed"
    | "user_not_found"
    | "user_not_in_channel"
    | "user_not_in_community"
    | "user_not_in_group"
    | "user_suspended";
