import { UnsupportedValueError } from "openchat-shared";

export function mapCommonResponses<T extends CommonCanisterResponse>(
    value: T,
    name: string,
): MapCommonResponseResult<T> {
    return mapCommonResponsesInner(value, name) as MapCommonResponseResult<T>;
}

function mapCommonResponsesInner(value: CommonCanisterResponse, name: string): CommonResponse {
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

// prettier-ignore
export type MapCommonResponseResult<T extends CommonCanisterResponse> = T extends "Success"
    ? "success"
    : T extends "SuccessV2"
    ? "success"
    : T extends "SuccessNoUpdates"
    ? "success_no_updates"
    : T extends "AlreadyEnded"
    ? "already_ended"
    : T extends "CallerNotInGroup"
    ? "caller_not_in_group"
    : T extends "ChannelNotFound"
    ? "channel_not_found"
    : T extends "ChatFrozen"
    ? "chat_frozen"
    : T extends "ChatNotFound"
    ? "chat_not_found"
    : T extends "CommunityFrozen"
    ? "community_frozen"
    : T extends "CommunityPublic"
    ? "community_public"
    : T extends "GroupFrozen"
    ? "group_frozen"
    : T extends "GroupNotPublic"
    ? "group_not_public"
    : T extends "InternalError"
    ? "internal_error"
    : T extends "Invalid"
    ? "invalid"
    : T extends "MessageNotFound"
    ? "message_not_found"
    : T extends "NotAuthorized"
    ? "not_authorized"
    : T extends "ThreadMessageNotFound"
    ? "thread_message_not_found"
    : T extends "ThreadNotFound"
    ? "thread_not_found"
    : T extends "UserLapsed"
    ? "user_lapsed"
    : T extends "UserNotFound"
    ? "user_not_found"
    : T extends "UserNotInChannel"
    ? "user_not_in_channel"
    : T extends "UserNotInCommunity"
    ? "user_not_in_community"
    : T extends "UserNotInGroup"
    ? "user_not_in_group"
    : T extends "UserSuspended"
    ? "user_suspended"
    : T extends { InternalError: string }
    ? "internal_error"
    : never;
