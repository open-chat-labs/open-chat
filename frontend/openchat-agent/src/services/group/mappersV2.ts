import type {
    ConvertToCommunityResponse,
    GroupCanisterGroupChatSummary,
    GroupCanisterGroupChatSummaryUpdates,
    GroupMembershipUpdates,
    MemberRole,
    OptionalChatPermissions,
    OptionalMessagePermissions,
    UpdatedRules,
} from "openchat-shared";
import {
    emptyChatMetrics,
    ROLE_ADMIN,
    ROLE_MEMBER,
    ROLE_MODERATOR,
    ROLE_NONE,
    ROLE_OWNER,
    toBigInt32,
} from "openchat-shared";
import type {
    GroupConvertIntoCommunitySuccessResult,
    GroupRole,
    GroupCanisterGroupChatSummary as TGroupCanisterGroupChatSummary,
    GroupCanisterGroupChatSummaryUpdates as TGroupCanisterGroupChatSummaryUpdates,
    GroupMembershipUpdates as TGroupMembershipUpdates,
    OptionalGroupPermissions as TOptionalGroupPermissions,
    OptionalMessagePermissions as TOptionalMessagePermissions,
    UpdatedRules as TUpdatedRules,
} from "../../typebox";
import {
    apiOptionUpdateV2,
    identity,
    mapOptional,
    optionUpdateV2,
    principalBytesToString,
} from "../../utils/mapping";
import {
    accessGateConfig,
    apiPermissionRole,
    chatMetrics,
    groupPermissions,
    groupSubtype,
    memberRole,
    mentions,
    messageEvent,
    threadSyncDetails,
    updatedEvent,
    videoCallInProgress,
} from "../common/chatMappersV2";

export function apiRole(role: MemberRole): GroupRole | undefined {
    switch (role) {
        case ROLE_ADMIN:
            return "Admin";
        case ROLE_MODERATOR:
            return "Moderator";
        case ROLE_MEMBER:
            return "Participant";
        case ROLE_OWNER:
            return "Owner";
        default:
            return undefined;
    }
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
        public: value.is_public ?? false,
        historyVisible: value.history_visible_to_new_joiners ?? false,
        minVisibleEventIndex: value.min_visible_event_index ?? 0,
        minVisibleMessageIndex: value.min_visible_message_index ?? 0,
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
        eventsTtlLastUpdated: value.events_ttl_last_updated ?? BigInt(0),
        localUserIndex: principalBytesToString(value.local_user_index_canister_id),
        videoCallInProgress: mapOptional(value.video_call_in_progress, videoCallInProgress),
        messagesVisibleToNonMembers: value.messages_visible_to_non_members ?? false,
        membership: mapOptional(value.membership, (m) => ({
            joined: m.joined,
            role: memberRole(m.role),
            notificationsMuted: m.notifications_muted ?? false,
            atEveryoneMuted: m.at_everyone_muted ?? false,
            lapsed: m.lapsed ?? false,
            rulesAccepted: m.rules_accepted ?? false,
            latestThreads: m.latest_threads?.map(threadSyncDetails) ?? [],
            mentions: mentions(m.mentions),
            myMetrics: chatMetrics(m.my_metrics),
        })) ?? {
            joined: 0n,
            role: ROLE_NONE,
            mentions: [],
            latestThreads: [],
            myMetrics: emptyChatMetrics(),
            notificationsMuted: false,
            atEveryoneMuted: false,
            rulesAccepted: false,
            lapsed: false,
        },
        verified: value.verified ?? false,
    };
}

export function groupMembershipUpdates(value: TGroupMembershipUpdates): GroupMembershipUpdates {
    return {
        myRole: mapOptional(value.role, memberRole),
        mentions: mentions(value.mentions),
        notificationsMuted: value.notifications_muted,
        atEveryoneMuted: value.at_everyone_muted,
        myMetrics: mapOptional(value.my_metrics, chatMetrics),
        latestThreads: value.latest_threads?.map(threadSyncDetails) ?? [],
        unfollowedThreads: value.unfollowed_threads ?? [],
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
        updatedEvents: value.updated_events?.map(updatedEvent) ?? [],
        dateLastPinned: value.date_last_pinned,
        gateConfig: optionUpdateV2(value.gate_config, accessGateConfig),
        eventsTTL: optionUpdateV2(value.events_ttl, identity),
        eventsTtlLastUpdated: value.events_ttl_last_updated,
        videoCallInProgress: optionUpdateV2(value.video_call_in_progress, videoCallInProgress),
        messagesVisibleToNonMembers: value.messages_visible_to_non_members,
        membership: mapOptional(value.membership, groupMembershipUpdates),
        verified: mapOptional(value.verified, identity),
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

export function convertToCommunitySuccess(
    value: GroupConvertIntoCommunitySuccessResult,
): ConvertToCommunityResponse {
    return {
        kind: "success",
        id: {
            kind: "channel",
            communityId: principalBytesToString(value.community_id),
            channelId: Number(toBigInt32(value.channel_id)),
        },
    };
}

export function apiUpdatedRules(rules: UpdatedRules): TUpdatedRules {
    return {
        text: rules.text,
        enabled: rules.enabled,
        new_version: rules.newVersion,
    };
}
