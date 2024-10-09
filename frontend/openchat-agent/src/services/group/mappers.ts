import type {
    ApiEventsResponse,
    ApiRemoveParticipantResponse,
    ApiSendMessageResponse,
    ApiRole,
    ApiMessagesByMessageIndexResponse,
    ApiGroupCanisterGroupChatSummary,
    ApiGroupCanisterGroupChatSummaryUpdates,
    ApiGroupCanisterSummaryResponse,
    ApiGroupCanisterSummaryUpdatesResponse,
    ApiGroupGateUpdate,
    ApiConvertIntoCommunityResponse,
    ApiUpdatedRules,
    ApiFollowThreadResponse,
    ApiUnfollowThreadResponse,
    ApiOptionalMessagePermissions,
    ApiBlockUserResponse,
    ApiUnblockUserResponse,
} from "./candid/idl";
import type {
    ApiEventsResponse as ApiCommunityEventsResponse,
    ApiMessagesByMessageIndexResponse as ApiCommunityMessagesByMessageIndexResponse,
} from "../community/candid/idl";
import type {
    ChatEvent,
    EventsResponse,
    SendMessageResponse,
    RemoveMemberResponse,
    BlockUserResponse,
    UnblockUserResponse,
    MemberRole,
    Message,
    GroupCanisterGroupChatSummary,
    GroupCanisterGroupChatSummaryUpdates,
    GroupCanisterSummaryResponse,
    GroupCanisterSummaryUpdatesResponse,
    UpdatedEvent,
    ChatIdentifier,
    MultiUserChatIdentifier,
    ConvertToCommunityResponse,
    UpdatedRules,
    FollowThreadResponse,
    OptionalChatPermissions,
    OptionalMessagePermissions,
} from "openchat-shared";
import { CommonResponses, UnsupportedValueError } from "openchat-shared";
import type { Principal } from "@dfinity/principal";
import {
    apiOptional,
    apiPermissionRole,
    chatMetrics,
    accessGate,
    groupPermissions,
    memberRole,
    groupSubtype,
    messageEvent,
    threadDetails,
    mention,
    eventsSuccessResponse,
    messagesSuccessResponse,
    accessGateConfig,
} from "../common/chatMappers";
import { ensureReplicaIsUpToDate } from "../common/replicaUpToDateChecker";
import { apiOptionUpdate, identity, optional, optionUpdate } from "../../utils/mapping";
import { ReplicaNotUpToDateError } from "../error";
import type { OptionalGroupPermissions, ReportMessageResponse } from "./candid/types";

export function apiRole(role: MemberRole): ApiRole | undefined {
    switch (role) {
        case "admin":
            return { Admin: null };
        case "moderator":
            return { Moderator: null };
        case "member":
            return { Participant: null };
        case "owner":
            return { Owner: null };
        default:
            return undefined;
    }
}

export function summaryResponse(
    candid: ApiGroupCanisterSummaryResponse,
): GroupCanisterSummaryResponse {
    if ("Success" in candid) {
        return groupChatSummary(candid.Success.summary);
    }
    if ("CallerNotInGroup" in candid) {
        return { kind: "caller_not_in_group" };
    }
    throw new UnsupportedValueError(
        "Unexpected ApiGroupCanisterSummaryResponse type received",
        candid,
    );
}

export function groupChatSummary(
    candid: ApiGroupCanisterGroupChatSummary,
): GroupCanisterGroupChatSummary {
    return {
        id: { kind: "group_chat", groupId: candid.chat_id.toString() },
        lastUpdated: candid.last_updated,
        name: candid.name,
        description: candid.description,
        subtype: optional(candid.subtype, groupSubtype),
        avatarId: optional(candid.avatar_id, identity),
        public: candid.is_public,
        historyVisible: candid.history_visible_to_new_joiners,
        minVisibleEventIndex: candid.min_visible_event_index,
        minVisibleMessageIndex: candid.min_visible_message_index,
        latestMessage: optional(candid.latest_message, messageEvent),
        latestEventIndex: candid.latest_event_index,
        latestMessageIndex: optional(candid.latest_message_index, identity),
        joined: candid.joined,
        memberCount: candid.participant_count,
        myRole: memberRole(candid.role),
        mentions: candid.mentions
            .filter((m) => m.thread_root_message_index.length === 0)
            .map(mention),
        permissions: groupPermissions(candid.permissions_v2),
        notificationsMuted: candid.notifications_muted,
        metrics: chatMetrics(candid.metrics),
        myMetrics: chatMetrics(candid.my_metrics),
        latestThreads: candid.latest_threads.map(threadDetails),
        frozen: candid.frozen.length > 0,
        dateLastPinned: optional(candid.date_last_pinned, identity),
        gateConfig: optional(candid.gate_config, accessGateConfig) ?? {
            gate: { kind: "no_gate" },
            expiry: undefined,
        },
        rulesAccepted: candid.rules_accepted,
        eventsTTL: optional(candid.events_ttl, identity),
        eventsTtlLastUpdated: candid.events_ttl_last_updated,
        localUserIndex: candid.local_user_index_canister_id.toString(),
        videoCallInProgress: optional(candid.video_call_in_progress, (v) => v.message_index),
        messagesVisibleToNonMembers: candid.messages_visible_to_non_members,
    };
}

export function summaryUpdatesResponse(
    candid: ApiGroupCanisterSummaryUpdatesResponse,
): GroupCanisterSummaryUpdatesResponse {
    if ("Success" in candid) {
        return groupChatSummaryUpdates(candid.Success.updates);
    }
    if ("SuccessNoUpdates" in candid) {
        return { kind: "success_no_updates" };
    }
    if ("CallerNotInGroup" in candid) {
        return { kind: "caller_not_in_group" };
    }
    throw new UnsupportedValueError(
        "Unexpected ApiGroupCanisterSummaryUpdatesResponse type received",
        candid,
    );
}

export function groupChatSummaryUpdates(
    candid: ApiGroupCanisterGroupChatSummaryUpdates,
): GroupCanisterGroupChatSummaryUpdates {
    return {
        id: { kind: "group_chat", groupId: candid.chat_id.toString() },
        lastUpdated: candid.last_updated,
        name: optional(candid.name, identity),
        description: optional(candid.description, identity),
        subtype: optionUpdate(candid.subtype, groupSubtype),
        avatarId: optionUpdate(candid.avatar_id, identity),
        public: optional(candid.is_public, identity),
        latestMessage: optional(candid.latest_message, messageEvent),
        latestEventIndex: optional(candid.latest_event_index, identity),
        latestMessageIndex: optional(candid.latest_message_index, identity),
        memberCount: optional(candid.participant_count, identity),
        myRole: optional(candid.role, memberRole),
        mentions: candid.mentions
            .filter((m) => m.thread_root_message_index.length === 0)
            .map(mention),
        permissions: optional(candid.permissions_v2, groupPermissions),
        notificationsMuted: optional(candid.notifications_muted, identity),
        metrics: optional(candid.metrics, chatMetrics),
        myMetrics: optional(candid.my_metrics, chatMetrics),
        latestThreads: candid.latest_threads.map(threadDetails),
        unfollowedThreads: Array.from(candid.unfollowed_threads),
        frozen: optionUpdate(candid.frozen, (_) => true),
        updatedEvents: candid.updated_events.map(updatedEvent),
        dateLastPinned: optional(candid.date_last_pinned, identity),
        gateConfig: optionUpdate(candid.gate_config, accessGateConfig),
        rulesAccepted: optional(candid.rules_accepted, identity),
        eventsTTL: optionUpdate(candid.events_ttl, identity),
        eventsTtlLastUpdated: optional(candid.events_ttl_last_updated, identity),
        videoCallInProgress: optionUpdate(candid.video_call_in_progress, (v) => v.message_index),
        messagesVisibleToNonMembers: optional(candid.messages_visible_to_non_members, identity),
    };
}

function updatedEvent([threadRootMessageIndex, eventIndex, timestamp]: [
    [] | [number],
    number,
    bigint,
]): UpdatedEvent {
    return {
        eventIndex,
        threadRootMessageIndex: optional(threadRootMessageIndex, identity),
        timestamp,
    };
}

export function apiOptionalGroupPermissions(
    permissions: OptionalChatPermissions,
): OptionalGroupPermissions {
    return {
        delete_messages: apiOptional(apiPermissionRole, permissions.deleteMessages),
        remove_members: apiOptional(apiPermissionRole, permissions.removeMembers),
        update_group: apiOptional(apiPermissionRole, permissions.updateGroup),
        invite_users: apiOptional(apiPermissionRole, permissions.inviteUsers),
        add_members: apiOptional(apiPermissionRole, permissions.addMembers),
        change_roles: apiOptional(apiPermissionRole, permissions.changeRoles),
        pin_messages: apiOptional(apiPermissionRole, permissions.pinMessages),
        react_to_messages: apiOptional(apiPermissionRole, permissions.reactToMessages),
        mention_all_members: apiOptional(apiPermissionRole, permissions.mentionAllMembers),
        start_video_call: apiOptional(apiPermissionRole, permissions.startVideoCall),
        message_permissions: apiOptional(
            apiOptionalMessagePermissions,
            permissions.messagePermissions,
        ),
        thread_permissions: apiOptionUpdate(
            apiOptionalMessagePermissions,
            permissions.threadPermissions,
        ),
    };
}

function apiOptionalMessagePermissions(
    permissions: OptionalMessagePermissions,
): ApiOptionalMessagePermissions {
    const custom_updated =
        permissions.memeFighter !== undefined && permissions.memeFighter !== "set_to_none"
            ? [{ subtype: "meme_fighter", role: apiPermissionRole(permissions.memeFighter.value) }]
            : [];
    const custom_deleted = permissions.memeFighter === "set_to_none" ? ["meme_fighter"] : [];
    return {
        default: apiOptional(apiPermissionRole, permissions.default),
        text: apiOptionUpdate(apiPermissionRole, permissions.text),
        image: apiOptionUpdate(apiPermissionRole, permissions.image),
        video: apiOptionUpdate(apiPermissionRole, permissions.video),
        audio: apiOptionUpdate(apiPermissionRole, permissions.audio),
        file: apiOptionUpdate(apiPermissionRole, permissions.file),
        poll: apiOptionUpdate(apiPermissionRole, permissions.poll),
        crypto: apiOptionUpdate(apiPermissionRole, permissions.crypto),
        giphy: apiOptionUpdate(apiPermissionRole, permissions.giphy),
        prize: apiOptionUpdate(apiPermissionRole, permissions.prize),
        p2p_swap: apiOptionUpdate(apiPermissionRole, permissions.p2pSwap),
        // p2p_trade: apiOptionUpdate(apiPermissionRole, undefined),
        video_call: apiOptionUpdate(apiPermissionRole, undefined),
        custom_updated,
        custom_deleted,
    };
}

export function unblockUserResponse(candid: ApiUnblockUserResponse): UnblockUserResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("GroupNotPublic" in candid) {
        return "group_not_public";
    }
    if ("CallerNotInGroup" in candid) {
        return "caller_not_in_group";
    }
    if ("NotAuthorized" in candid) {
        return "not_authorized";
    }
    if ("CannotUnblockSelf" in candid) {
        return "cannot_unblock_self";
    }
    if ("UserSuspended" in candid) {
        return "user_suspended";
    }
    if ("UserLapsed" in candid) {
        return "user_lapsed";
    }
    if ("ChatFrozen" in candid) {
        return "chat_frozen";
    }
    throw new UnsupportedValueError("Unexpected ApiDeleteMessageResponse type received", candid);
}

export function blockUserResponse(candid: ApiBlockUserResponse): BlockUserResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("GroupNotPublic" in candid) {
        return "group_not_public";
    }
    if ("UserNotInGroup" in candid) {
        return "user_not_in_group";
    }
    if ("CallerNotInGroup" in candid) {
        return "caller_not_in_group";
    }
    if ("NotAuthorized" in candid) {
        return "not_authorized";
    }
    if ("InternalError" in candid) {
        return "internal_error";
    }
    if ("CannotBlockSelf" in candid) {
        return "cannot_block_self";
    }
    if ("CannotBlockUser" in candid) {
        return "cannot_block_user";
    }
    if ("UserSuspended" in candid) {
        return "user_suspended";
    }
    if ("UserLapsed" in candid) {
        return "user_lapsed";
    }
    if ("ChatFrozen" in candid) {
        return "chat_frozen";
    }
    throw new UnsupportedValueError("Unexpected ApiDeleteMessageResponse type received", candid);
}

// TODO fill this in
export function apiGateUpdate(): ApiGroupGateUpdate {
    return { NoChange: null };
}

export function sendMessageResponse(candid: ApiSendMessageResponse): SendMessageResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            timestamp: candid.Success.timestamp,
            messageIndex: candid.Success.message_index,
            eventIndex: candid.Success.event_index,
            expiresAt: optional(candid.Success.expires_at, Number),
        };
    }
    if ("CallerNotInGroup" in candid) {
        return { kind: "not_in_group" };
    }
    if ("TextTooLong" in candid) {
        return { kind: "text_too_long" };
    }
    if ("MessageEmpty" in candid) {
        return { kind: "message_empty" };
    }
    if ("InvalidRequest" in candid) {
        return { kind: "invalid_request", reason: candid.InvalidRequest };
    }
    if ("InvalidPoll" in candid) {
        return { kind: "invalid_poll" };
    }
    if ("NotAuthorized" in candid) {
        return { kind: "not_authorized" };
    }
    if ("ThreadMessageNotFound" in candid) {
        return { kind: "thread_message_not_found" };
    }
    if ("UserSuspended" in candid) {
        return { kind: "user_suspended" };
    }
    if ("UserLapsed" in candid) {
        return { kind: "user_lapsed" };
    }
    if ("ChatFrozen" in candid) {
        return { kind: "chat_frozen" };
    }
    if ("RulesNotAccepted" in candid) {
        return { kind: "rules_not_accepted" };
    }

    throw new UnsupportedValueError("Unexpected ApiSendMessageResponse type received", candid);
}

export function removeMemberResponse(candid: ApiRemoveParticipantResponse): RemoveMemberResponse {
    if ("Success" in candid) {
        return "success";
    } else {
        console.warn("RemoveMember failed with ", candid);
        return "failure";
    }
}

export async function getMessagesByMessageIndexResponse(
    principal: Principal,
    candid: ApiMessagesByMessageIndexResponse | ApiCommunityMessagesByMessageIndexResponse,
    chatId: MultiUserChatIdentifier,
    latestKnownUpdatePreRequest: bigint | undefined,
): Promise<EventsResponse<Message>> {
    if ("Success" in candid) {
        await ensureReplicaIsUpToDate(principal, chatId, candid.Success.chat_last_updated);

        return messagesSuccessResponse(candid.Success);
    }
    if (
        "CallerNotInGroup" in candid ||
        "ThreadNotFound" in candid ||
        "UserNotInChannel" in candid ||
        "ChannelNotFound" in candid ||
        "UserNotInCommunity" in candid ||
        "UserSuspended" in candid ||
        "UserLapsed" in candid ||
        "ThreadMessageNotFound" in candid
    ) {
        return "events_failed";
    }
    if ("ReplicaNotUpToDateV2" in candid) {
        throw ReplicaNotUpToDateError.byTimestamp(
            candid.ReplicaNotUpToDateV2,
            latestKnownUpdatePreRequest ?? BigInt(-1),
            false,
        );
    }
    throw new UnsupportedValueError(
        "Unexpected ApiMessagesByMessageIndexResponse type received",
        candid,
    );
}

export async function getEventsResponse(
    principal: Principal,
    candid: ApiEventsResponse | ApiCommunityEventsResponse,
    chatId: ChatIdentifier,
    latestKnownUpdatePreRequest: bigint | undefined,
): Promise<EventsResponse<ChatEvent>> {
    if ("Success" in candid) {
        await ensureReplicaIsUpToDate(principal, chatId, candid.Success.chat_last_updated);

        return eventsSuccessResponse(candid.Success);
    }
    if ("ReplicaNotUpToDateV2" in candid) {
        throw ReplicaNotUpToDateError.byTimestamp(
            candid.ReplicaNotUpToDateV2,
            latestKnownUpdatePreRequest ?? BigInt(-1),
            false,
        );
    }
    console.warn("GetGroupChatEvents failed with ", candid);
    return "events_failed";
}

export function convertToCommunityReponse(
    candid: ApiConvertIntoCommunityResponse,
): ConvertToCommunityResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            id: {
                kind: "channel",
                communityId: candid.Success.community_id.toString(),
                channelId: candid.Success.channel_id.toString(),
            },
        };
    } else {
        console.warn("ConvertToCommunity failed with ", candid);
        return CommonResponses.failure();
    }
}

export function apiUpdatedRules(rules: UpdatedRules): ApiUpdatedRules {
    return {
        text: rules.text,
        enabled: rules.enabled,
        new_version: rules.newVersion,
    };
}

export function followThreadResponse(
    candid: ApiFollowThreadResponse | ApiUnfollowThreadResponse,
): FollowThreadResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("AlreadyFollowing" in candid || "NotFollowing" in candid) {
        return "unchanged";
    } else {
        console.warn("followThread failed with", candid);
        return "failed";
    }
}

export function reportMessageResponse(candid: ReportMessageResponse): boolean {
    return "Success" in candid || "AlreadyReported" in candid;
}
