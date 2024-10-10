import type {
    CommunityEventsResponse,
    CommunityMessagesByMessageIndexResponse,
    GroupCanisterGroupChatSummary as TGroupCanisterGroupChatSummary,
    GroupCanisterGroupChatSummaryUpdates as TGroupCanisterGroupChatSummaryUpdates,
    GroupEventsResponse,
    GroupMessagesByMessageIndexResponse,
    GroupSendMessageResponse,
    OptionalGroupPermissions as TOptionalGroupPermissions,
    OptionalMessagePermissions as TOptionalMessagePermissions,
    UpdatedRules as TUpdatedRules,
} from "../../typebox";
import type {
    ChatEvent,
    EventsResponse,
    SendMessageResponse,
    // RemoveMemberResponse,
    // BlockUserResponse,
    // UnblockUserResponse,
    // MemberRole,
    Message,
    GroupCanisterGroupChatSummary,
    GroupCanisterGroupChatSummaryUpdates,
    // GroupCanisterSummaryResponse,
    // GroupCanisterSummaryUpdatesResponse,
    // UpdatedEvent,
    ChatIdentifier,
    MultiUserChatIdentifier,
    // ConvertToCommunityResponse,
    UpdatedRules,
    // FollowThreadResponse,
    OptionalChatPermissions,
    OptionalMessagePermissions,
} from "openchat-shared";
import {
    // CommonResponses,
    UnsupportedValueError,
} from "openchat-shared";
import {
    accessGate,
    apiPermissionRole,
    chatMetrics,
    eventsSuccessResponse,
    groupPermissions,
    groupSubtype,
    memberRole,
    mention,
    messageEvent,
    messagesSuccessResponse,
    threadSyncDetails,
    updatedEvent,
} from "../common/chatMappersV2";
import { ensureReplicaIsUpToDate } from "../common/replicaUpToDateChecker";
import {
    apiOptionUpdateV2,
    identity,
    mapOptional,
    optionUpdateV2,
    principalBytesToString,
} from "../../utils/mapping";
import type { Principal } from "@dfinity/principal";
import { ReplicaNotUpToDateError } from "../error";

// export function apiRole(role: MemberRole): ApiRole | undefined {
//     switch (role) {
//         case "admin":
//             return { Admin: null };
//         case "moderator":
//             return { Moderator: null };
//         case "member":
//             return { Participant: null };
//         case "owner":
//             return { Owner: null };
//         default:
//             return undefined;
//     }
// }
//
// export function summaryResponse(
//     candid: ApiGroupCanisterSummaryResponse,
// ): GroupCanisterSummaryResponse {
//     if ("Success" in candid) {
//         return groupChatSummary(candid.Success.summary);
//     }
//     if ("CallerNotInGroup" in candid) {
//         return { kind: "caller_not_in_group" };
//     }
//     throw new UnsupportedValueError(
//         "Unexpected ApiGroupCanisterSummaryResponse type received",
//         candid,
//     );
// }

export function groupChatSummary(
    value: TGroupCanisterGroupChatSummary,
): GroupCanisterGroupChatSummary {
    return {
        id: { kind: "group_chat", groupId: principalBytesToString(value.chat_id) },
        lastUpdated: value.last_updated,
        name: value.name,
        description: value.description,
        subtype: mapOptional(value.subtype, groupSubtype),
        avatarId: value.avatar_id,
        public: value.is_public,
        historyVisible: value.history_visible_to_new_joiners,
        minVisibleEventIndex: value.min_visible_event_index,
        minVisibleMessageIndex: value.min_visible_message_index,
        latestMessage: mapOptional(value.latest_message, messageEvent),
        latestEventIndex: value.latest_event_index,
        latestMessageIndex: value.latest_message_index,
        joined: value.joined,
        memberCount: value.participant_count,
        myRole: memberRole(value.role),
        mentions: value.mentions
            .filter((m) => m.thread_root_message_index !== undefined)
            .map(mention),
        permissions: groupPermissions(value.permissions_v2),
        notificationsMuted: value.notifications_muted,
        metrics: chatMetrics(value.metrics),
        myMetrics: chatMetrics(value.my_metrics),
        latestThreads: value.latest_threads.map(threadSyncDetails),
        frozen: value.frozen !== undefined,
        dateLastPinned: value.date_last_pinned,
        gate: mapOptional(value.gate, accessGate) ?? { kind: "no_gate" },
        rulesAccepted: value.rules_accepted,
        eventsTTL: value.events_ttl,
        eventsTtlLastUpdated: value.events_ttl_last_updated,
        localUserIndex: principalBytesToString(value.local_user_index_canister_id),
        videoCallInProgress: mapOptional(value.video_call_in_progress, (v) => v.message_index),
        messagesVisibleToNonMembers: value.messages_visible_to_non_members,
    };
}

// export function summaryUpdatesResponse(
//     candid: ApiGroupCanisterSummaryUpdatesResponse,
// ): GroupCanisterSummaryUpdatesResponse {
//     if ("Success" in candid) {
//         return groupChatSummaryUpdates(candid.Success.updates);
//     }
//     if ("SuccessNoUpdates" in candid) {
//         return { kind: "success_no_updates" };
//     }
//     if ("CallerNotInGroup" in candid) {
//         return { kind: "caller_not_in_group" };
//     }
//     throw new UnsupportedValueError(
//         "Unexpected ApiGroupCanisterSummaryUpdatesResponse type received",
//         candid,
//     );
// }

export function groupChatSummaryUpdates(
    value: TGroupCanisterGroupChatSummaryUpdates,
): GroupCanisterGroupChatSummaryUpdates {
    return {
        id: { kind: "group_chat", groupId: principalBytesToString(value.chat_id) },
        lastUpdated: value.last_updated,
        name: value.name,
        description: value.description,
        subtype: optionUpdateV2(value.subtype, groupSubtype),
        avatarId: optionUpdateV2(value.avatar_id, identity),
        public: value.is_public,
        latestMessage: mapOptional(value.latest_message, messageEvent),
        latestEventIndex: value.latest_event_index,
        latestMessageIndex: value.latest_message_index,
        memberCount: value.participant_count,
        myRole: mapOptional(value.role, memberRole),
        mentions: value.mentions
            .filter((m) => m.thread_root_message_index === undefined)
            .map(mention),
        permissions: mapOptional(value.permissions_v2, groupPermissions),
        notificationsMuted: value.notifications_muted,
        metrics: mapOptional(value.metrics, chatMetrics),
        myMetrics: mapOptional(value.my_metrics, chatMetrics),
        latestThreads: value.latest_threads.map(threadSyncDetails),
        unfollowedThreads: Array.from(value.unfollowed_threads),
        frozen: optionUpdateV2(value.frozen, (_) => true),
        updatedEvents: value.updated_events.map(updatedEvent),
        dateLastPinned: value.date_last_pinned,
        gate: optionUpdateV2(value.gate, accessGate),
        rulesAccepted: value.rules_accepted,
        eventsTTL: optionUpdateV2(value.events_ttl, identity),
        eventsTtlLastUpdated: value.events_ttl_last_updated,
        videoCallInProgress: optionUpdateV2(value.video_call_in_progress, (v) => v.message_index),
        messagesVisibleToNonMembers: value.messages_visible_to_non_members,
    };
}

export function apiOptionalGroupPermissions(
    permissions: OptionalChatPermissions,
): TOptionalGroupPermissions {
    return {
        delete_messages: mapOptional(permissions.deleteMessages, apiPermissionRole),
        remove_members: mapOptional(permissions.removeMembers, apiPermissionRole),
        update_group: mapOptional(permissions.updateGroup, apiPermissionRole),
        invite_users: mapOptional(permissions.inviteUsers, apiPermissionRole),
        add_members: mapOptional(permissions.addMembers, apiPermissionRole),
        change_roles: mapOptional(permissions.changeRoles, apiPermissionRole),
        pin_messages: mapOptional(permissions.pinMessages, apiPermissionRole),
        react_to_messages: mapOptional(permissions.reactToMessages, apiPermissionRole),
        mention_all_members: mapOptional(permissions.mentionAllMembers, apiPermissionRole),
        start_video_call: mapOptional(permissions.startVideoCall, apiPermissionRole),
        message_permissions: mapOptional(
            permissions.messagePermissions,
            apiOptionalMessagePermissions,
        ),
        thread_permissions: apiOptionUpdateV2(
            apiOptionalMessagePermissions,
            permissions.threadPermissions,
        ),
    };
}

function apiOptionalMessagePermissions(
    permissions: OptionalMessagePermissions,
): TOptionalMessagePermissions {
    const custom_updated =
        permissions.memeFighter !== undefined && permissions.memeFighter !== "set_to_none"
            ? [{ subtype: "meme_fighter", role: apiPermissionRole(permissions.memeFighter.value) }]
            : [];
    const custom_deleted = permissions.memeFighter === "set_to_none" ? ["meme_fighter"] : [];
    return {
        default: mapOptional(permissions.default, apiPermissionRole),
        text: apiOptionUpdateV2(apiPermissionRole, permissions.text),
        image: apiOptionUpdateV2(apiPermissionRole, permissions.image),
        video: apiOptionUpdateV2(apiPermissionRole, permissions.video),
        audio: apiOptionUpdateV2(apiPermissionRole, permissions.audio),
        file: apiOptionUpdateV2(apiPermissionRole, permissions.file),
        poll: apiOptionUpdateV2(apiPermissionRole, permissions.poll),
        crypto: apiOptionUpdateV2(apiPermissionRole, permissions.crypto),
        giphy: apiOptionUpdateV2(apiPermissionRole, permissions.giphy),
        prize: apiOptionUpdateV2(apiPermissionRole, permissions.prize),
        p2p_swap: apiOptionUpdateV2(apiPermissionRole, permissions.p2pSwap),
        video_call: apiOptionUpdateV2(apiPermissionRole, undefined),
        custom_updated,
        custom_deleted,
    };
}
//
// export function unblockUserResponse(candid: ApiUnblockUserResponse): UnblockUserResponse {
//     if ("Success" in candid) {
//         return "success";
//     }
//     if ("GroupNotPublic" in candid) {
//         return "group_not_public";
//     }
//     if ("CallerNotInGroup" in candid) {
//         return "caller_not_in_group";
//     }
//     if ("NotAuthorized" in candid) {
//         return "not_authorized";
//     }
//     if ("CannotUnblockSelf" in candid) {
//         return "cannot_unblock_self";
//     }
//     if ("UserSuspended" in candid) {
//         return "user_suspended";
//     }
//     if ("ChatFrozen" in candid) {
//         return "chat_frozen";
//     }
//     throw new UnsupportedValueError("Unexpected ApiDeleteMessageResponse type received", candid);
// }
//
// export function blockUserResponse(candid: ApiBlockUserResponse): BlockUserResponse {
//     if ("Success" in candid) {
//         return "success";
//     }
//     if ("GroupNotPublic" in candid) {
//         return "group_not_public";
//     }
//     if ("UserNotInGroup" in candid) {
//         return "user_not_in_group";
//     }
//     if ("CallerNotInGroup" in candid) {
//         return "caller_not_in_group";
//     }
//     if ("NotAuthorized" in candid) {
//         return "not_authorized";
//     }
//     if ("InternalError" in candid) {
//         return "internal_error";
//     }
//     if ("CannotBlockSelf" in candid) {
//         return "cannot_block_self";
//     }
//     if ("CannotBlockUser" in candid) {
//         return "cannot_block_user";
//     }
//     if ("UserSuspended" in candid) {
//         return "user_suspended";
//     }
//     if ("ChatFrozen" in candid) {
//         return "chat_frozen";
//     }
//     throw new UnsupportedValueError("Unexpected ApiDeleteMessageResponse type received", candid);
// }
//
// // TODO fill this in
// export function apiGateUpdate(): ApiGroupGateUpdate {
//     return { NoChange: null };
// }

export function sendMessageResponse(value: GroupSendMessageResponse): SendMessageResponse {
    if (typeof value === "object") {
        if ("Success" in value) {
            return {
                kind: "success",
                timestamp: value.Success.timestamp,
                messageIndex: value.Success.message_index,
                eventIndex: value.Success.event_index,
                expiresAt: mapOptional(value.Success.expires_at, Number),
            };
        }
        if ("TextTooLong" in value) {
            return { kind: "text_too_long" };
        }
        if ("InvalidRequest" in value) {
            return { kind: "invalid_request", reason: value.InvalidRequest };
        }
        if ("InvalidPoll" in value) {
            return { kind: "invalid_poll" };
        }
    }
    if (value === "CallerNotInGroup") {
        return { kind: "not_in_group" };
    }
    if (value === "MessageEmpty") {
        return { kind: "message_empty" };
    }
    if (value === "NotAuthorized") {
        return { kind: "not_authorized" };
    }
    if (value === "ThreadMessageNotFound") {
        return { kind: "thread_message_not_found" };
    }
    if (value === "UserSuspended") {
        return { kind: "user_suspended" };
    }
    if (value === "UserLapsed") {
        return { kind: "user_lapsed" };
    }
    if (value === "ChatFrozen") {
        return { kind: "chat_frozen" };
    }
    if (value === "RulesNotAccepted") {
        return { kind: "rules_not_accepted" };
    }

    throw new UnsupportedValueError("Unexpected ApiSendMessageResponse type received", value);
}

// export function removeMemberResponse(candid: ApiRemoveParticipantResponse): RemoveMemberResponse {
//     if ("Success" in candid) {
//         return "success";
//     } else {
//         console.warn("RemoveMember failed with ", candid);
//         return "failure";
//     }
// }
//
export async function getMessagesByMessageIndexResponse(
    principal: Principal,
    value: GroupMessagesByMessageIndexResponse | CommunityMessagesByMessageIndexResponse,
    chatId: MultiUserChatIdentifier,
    latestKnownUpdatePreRequest: bigint | undefined,
): Promise<EventsResponse<Message>> {
    if (typeof value === "object") {
        if ("Success" in value) {
            await ensureReplicaIsUpToDate(principal, chatId, value.Success.chat_last_updated);

            return messagesSuccessResponse(value.Success);
        }
        if ("ReplicaNotUpToDateV2" in value) {
            throw ReplicaNotUpToDateError.byTimestamp(
                value.ReplicaNotUpToDateV2,
                latestKnownUpdatePreRequest ?? BigInt(-1),
                false,
            );
        }
    }
    console.warn("MessagesByMessageIndex failed with ", value);
    return "events_failed";
}

export async function getEventsResponse(
    principal: Principal,
    value: GroupEventsResponse | CommunityEventsResponse,
    chatId: ChatIdentifier,
    latestKnownUpdatePreRequest: bigint | undefined,
): Promise<EventsResponse<ChatEvent>> {
    if (typeof value === "object") {
        if ("Success" in value) {
            await ensureReplicaIsUpToDate(principal, chatId, value.Success.chat_last_updated);

            return eventsSuccessResponse(value.Success);
        }
        if ("ReplicaNotUpToDateV2" in value) {
            throw ReplicaNotUpToDateError.byTimestamp(
                value.ReplicaNotUpToDateV2,
                latestKnownUpdatePreRequest ?? BigInt(-1),
                false,
            );
        }
    }
    console.warn("GetGroupChatEvents failed with ", value);
    return "events_failed";
}

// export function convertToCommunityReponse(
//     candid: ApiConvertIntoCommunityResponse,
// ): ConvertToCommunityResponse {
//     if ("Success" in candid) {
//         return {
//             kind: "success",
//             id: {
//                 kind: "channel",
//                 communityId: candid.Success.community_id.toString(),
//                 channelId: candid.Success.channel_id.toString(),
//             },
//         };
//     } else {
//         console.warn("ConvertToCommunity failed with ", candid);
//         return CommonResponses.failure();
//     }
// }

export function apiUpdatedRules(rules: UpdatedRules): TUpdatedRules {
    return {
        text: rules.text,
        enabled: rules.enabled,
        new_version: rules.newVersion,
    };
}

// export function followThreadResponse(
//     candid: ApiFollowThreadResponse | ApiUnfollowThreadResponse,
// ): FollowThreadResponse {
//     if ("Success" in candid) {
//         return "success";
//     }
//     if ("AlreadyFollowing" in candid || "NotFollowing" in candid) {
//         return "unchanged";
//     } else {
//         console.warn("followThread failed with", candid);
//         return "failed";
//     }
// }
//
// export function reportMessageResponse(candid: ReportMessageResponse): boolean {
//     return "Success" in candid || "AlreadyReported" in candid;
// }
