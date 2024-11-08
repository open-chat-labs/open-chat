import type {
    CommunityEventsResponse,
    CommunityMessagesByMessageIndexResponse,
    GroupBlockUserResponse,
    GroupCanisterGroupChatSummary as TGroupCanisterGroupChatSummary,
    GroupCanisterGroupChatSummaryUpdates as TGroupCanisterGroupChatSummaryUpdates,
    GroupConvertIntoCommunityResponse,
    GroupEventsResponse,
    GroupFollowThreadResponse,
    GroupMessagesByMessageIndexResponse,
    GroupRemoveParticipantResponse,
    GroupReportMessageResponse,
    GroupRole,
    GroupSendMessageResponse,
    GroupSummaryResponse,
    GroupSummaryUpdatesResponse,
    GroupUnblockUserResponse,
    GroupUnfollowThreadResponse,
    OptionalGroupPermissions as TOptionalGroupPermissions,
    OptionalMessagePermissions as TOptionalMessagePermissions,
    UpdatedRules as TUpdatedRules,
    GroupMembershipUpdates as TGroupMembershipUpdates,
} from "../../typebox";
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
    ChatIdentifier,
    MultiUserChatIdentifier,
    ConvertToCommunityResponse,
    UpdatedRules,
    FollowThreadResponse,
    OptionalChatPermissions,
    OptionalMessagePermissions,
    GroupMembershipUpdates,
} from "openchat-shared";
import { CommonResponses, emptyChatMetrics } from "openchat-shared";
import {
    accessGateConfig,
    apiPermissionRole,
    chatMetrics,
    eventsSuccessResponse,
    groupPermissions,
    groupSubtype,
    memberRole,
    mentions,
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
import { mapCommonResponses } from "../common/commonResponseMapper";

export function apiRole(role: MemberRole): GroupRole | undefined {
    switch (role) {
        case "admin":
            return "Admin";
        case "moderator":
            return "Moderator";
        case "member":
            return "Participant";
        case "owner":
            return "Owner";
        default:
            return undefined;
    }
}

export function summaryResponse(value: GroupSummaryResponse): GroupCanisterSummaryResponse {
    if (typeof value === "object" && "Success" in value) {
        return groupChatSummary(value.Success.summary);
    }
    return {
        kind: mapCommonResponses(value, "GroupSummaryResponse"),
    };
}

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
        memberCount: value.participant_count,
        permissions: groupPermissions(value.permissions_v2),
        metrics: chatMetrics(value.metrics),
        frozen: value.frozen !== undefined,
        dateLastPinned: value.date_last_pinned,
        gateConfig: mapOptional(value.gate_config, accessGateConfig) ?? {
            gate: { kind: "no_gate" },
            expiry: undefined,
        },
        eventsTTL: value.events_ttl,
        eventsTtlLastUpdated: value.events_ttl_last_updated,
        localUserIndex: principalBytesToString(value.local_user_index_canister_id),
        videoCallInProgress: mapOptional(value.video_call_in_progress, (v) => v.message_index),
        messagesVisibleToNonMembers: value.messages_visible_to_non_members,
        membership: mapOptional(value.membership, (m) => ({
            joined: m.joined,
            role: memberRole(m.role),
            notificationsMuted: m.notifications_muted,
            lapsed: m.lapsed,
            rulesAccepted: m.rules_accepted,
            latestThreads: m.latest_threads.map(threadSyncDetails),
            mentions: mentions(m.mentions),
            myMetrics: chatMetrics(m.my_metrics),
        })) ?? {
            joined: 0n,
            role: "none",
            mentions: [],
            latestThreads: [],
            myMetrics: emptyChatMetrics(),
            notificationsMuted: false,
            rulesAccepted: false,
            lapsed: false,
        },
    };
}

export function summaryUpdatesResponse(
    value: GroupSummaryUpdatesResponse,
): GroupCanisterSummaryUpdatesResponse {
    if (typeof value === "object" && "Success" in value) {
        return groupChatSummaryUpdates(value.Success.updates);
    }
    return {
        kind: mapCommonResponses(value, "GroupSummaryUpdates"),
    };
}

export function groupMembershipUpdates(value: TGroupMembershipUpdates): GroupMembershipUpdates {
    return {
        myRole: mapOptional(value.role, memberRole),
        mentions: mentions(value.mentions),
        notificationsMuted: value.notifications_muted,
        myMetrics: mapOptional(value.my_metrics, chatMetrics),
        latestThreads: value.latest_threads.map(threadSyncDetails),
        unfollowedThreads: Array.from(value.unfollowed_threads),
        rulesAccepted: value.rules_accepted,
        lapsed: value.lapsed,
    };
}

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
        permissions: mapOptional(value.permissions_v2, groupPermissions),
        metrics: mapOptional(value.metrics, chatMetrics),
        frozen: optionUpdateV2(value.frozen, (_) => true),
        updatedEvents: value.updated_events.map(updatedEvent),
        dateLastPinned: value.date_last_pinned,
        gateConfig: optionUpdateV2(value.gate_config, accessGateConfig),
        eventsTTL: optionUpdateV2(value.events_ttl, identity),
        eventsTtlLastUpdated: value.events_ttl_last_updated,
        videoCallInProgress: optionUpdateV2(value.video_call_in_progress, (v) => v.message_index),
        messagesVisibleToNonMembers: value.messages_visible_to_non_members,
        membership: mapOptional(value.membership, groupMembershipUpdates),
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

export function unblockUserResponse(value: GroupUnblockUserResponse): UnblockUserResponse {
    if (value === "CannotUnblockSelf") {
        return "cannot_unblock_self";
    }
    return mapCommonResponses(value, "GroupUnblockUser");
}

export function blockUserResponse(value: GroupBlockUserResponse): BlockUserResponse {
    if (value === "CannotBlockSelf") {
        return "cannot_block_self";
    }
    if (value === "CannotBlockUser") {
        return "cannot_block_user";
    }
    return mapCommonResponses(value, "GroupBlockUser");
}

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
    if (value === "MessageEmpty") {
        return { kind: "message_empty" };
    }
    if (value === "RulesNotAccepted") {
        return { kind: "rules_not_accepted" };
    }
    return {
        kind: mapCommonResponses(value, "GroupSendMessage"),
    };
}

export function removeMemberResponse(value: GroupRemoveParticipantResponse): RemoveMemberResponse {
    if (value === "Success") {
        return "success";
    } else {
        console.warn("RemoveMember failed with ", value);
        return "failure";
    }
}

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

export function convertToCommunityResponse(
    value: GroupConvertIntoCommunityResponse,
): ConvertToCommunityResponse {
    if (typeof value === "object" && "Success" in value) {
        return {
            kind: "success",
            id: {
                kind: "channel",
                communityId: principalBytesToString(value.Success.community_id),
                channelId: value.Success.channel_id.toString(),
            },
        };
    } else {
        console.warn("ConvertToCommunity failed with ", value);
        return CommonResponses.failure();
    }
}

export function apiUpdatedRules(rules: UpdatedRules): TUpdatedRules {
    return {
        text: rules.text,
        enabled: rules.enabled,
        new_version: rules.newVersion,
    };
}

export function followThreadResponse(
    value: GroupFollowThreadResponse | GroupUnfollowThreadResponse,
): FollowThreadResponse {
    if (value === "Success") {
        return "success";
    }
    if (value === "AlreadyFollowing" || value === "NotFollowing") {
        return "unchanged";
    } else {
        console.warn("followThread failed with", value);
        return "failed";
    }
}

export function reportMessageResponse(value: GroupReportMessageResponse): boolean {
    return value === "Success" || value === "AlreadyReported";
}
