import type {
    ApiEventsResponse,
    ApiEventWrapper,
    ApiGroupChatEvent,
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
    EventsResponse,
    EventWrapper,
    GroupChatEvent,
    SendMessageResponse,
    RemoveMemberResponse,
    BlockUserResponse,
    UnblockUserResponse,
    MemberRole,
    Message,
    GroupInviteCodeChange,
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
    message,
    groupSubtype,
    messageEvent,
    threadDetails,
    mention,
    expiredEventsRange,
    expiredMessagesRange,
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

function groupChatSummary(candid: ApiGroupCanisterGroupChatSummary): GroupCanisterGroupChatSummary {
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
        gate: optional(candid.gate, accessGate) ?? { kind: "no_gate" },
        rulesAccepted: candid.rules_accepted,
        eventsTTL: optional(candid.events_ttl, identity),
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

function groupChatSummaryUpdates(
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
        gate: optionUpdate(candid.gate, accessGate),
        rulesAccepted: optional(candid.rules_accepted, identity),
        eventsTTL: optionUpdate(candid.events_ttl, identity),
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
        change_roles: apiOptional(apiPermissionRole, permissions.changeRoles),
        pin_messages: apiOptional(apiPermissionRole, permissions.pinMessages),
        react_to_messages: apiOptional(apiPermissionRole, permissions.reactToMessages),
        mention_all_members: apiOptional(apiPermissionRole, permissions.mentionAllMembers),
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
): Promise<EventsResponse<Message>> {
    if ("Success" in candid) {
        await ensureReplicaIsUpToDate(principal, chatId, candid.Success.chat_last_updated);

        return {
            events: candid.Success.messages.map(messageEvent),
            expiredEventRanges: [],
            expiredMessageRanges: [],
            latestEventIndex: candid.Success.latest_event_index,
        };
    }
    if (
        "CallerNotInGroup" in candid ||
        "ThreadNotFound" in candid ||
        "UserNotInChannel" in candid ||
        "ChannelNotFound" in candid ||
        "UserNotInCommunity" in candid ||
        "ThreadMessageNotFound" in candid
    ) {
        return "events_failed";
    }
    if ("ReplicaNotUpToDate" in candid) {
        throw ReplicaNotUpToDateError.byEventIndex(candid.ReplicaNotUpToDate, -1, false);
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
): Promise<EventsResponse<GroupChatEvent>> {
    if ("Success" in candid) {
        await ensureReplicaIsUpToDate(principal, chatId, candid.Success.chat_last_updated);

        return {
            events: candid.Success.events.map(event),
            expiredEventRanges: candid.Success.expired_event_ranges.map(expiredEventsRange),
            expiredMessageRanges: candid.Success.expired_message_ranges.map(expiredMessagesRange),
            latestEventIndex: candid.Success.latest_event_index,
        };
    }
    if ("ReplicaNotUpToDate" in candid) {
        throw ReplicaNotUpToDateError.byEventIndex(candid.ReplicaNotUpToDate, -1, false);
    }
    console.warn("GetGroupChatEvents failed with ", candid);
    return "events_failed";
}

function groupChatEvent(candid: ApiGroupChatEvent): GroupChatEvent {
    if ("Message" in candid) {
        return message(candid.Message);
    }
    if ("GroupChatCreated" in candid) {
        return {
            kind: "group_chat_created",
            name: candid.GroupChatCreated.name,
            description: candid.GroupChatCreated.description,
            created_by: candid.GroupChatCreated.created_by.toString(),
        };
    }
    if ("DirectChatCreated" in candid) {
        return {
            kind: "direct_chat_created",
        };
    }
    if ("ParticipantsAdded" in candid) {
        return {
            kind: "members_added",
            userIds: candid.ParticipantsAdded.user_ids.map((p) => p.toString()),
            addedBy: candid.ParticipantsAdded.added_by.toString(),
        };
    }
    if ("UsersInvited" in candid) {
        return {
            kind: "users_invited",
            userIds: candid.UsersInvited.user_ids.map((p) => p.toString()),
            invitedBy: candid.UsersInvited.invited_by.toString(),
        };
    }
    if ("ParticipantJoined" in candid) {
        return {
            kind: "member_joined",
            userId: candid.ParticipantJoined.user_id.toString(),
        };
    }
    if ("ParticipantsRemoved" in candid) {
        return {
            kind: "members_removed",
            userIds: candid.ParticipantsRemoved.user_ids.map((p) => p.toString()),
            removedBy: candid.ParticipantsRemoved.removed_by.toString(),
        };
    }
    if ("ParticipantLeft" in candid) {
        return {
            kind: "member_left",
            userId: candid.ParticipantLeft.user_id.toString(),
        };
    }

    if ("GroupNameChanged" in candid) {
        return {
            kind: "name_changed",
            changedBy: candid.GroupNameChanged.changed_by.toString(),
        };
    }

    if ("GroupDescriptionChanged" in candid) {
        return {
            kind: "desc_changed",
            changedBy: candid.GroupDescriptionChanged.changed_by.toString(),
        };
    }

    if ("GroupRulesChanged" in candid) {
        return {
            kind: "rules_changed",
            enabled: candid.GroupRulesChanged.enabled,
            enabledPrev: candid.GroupRulesChanged.prev_enabled,
            changedBy: candid.GroupRulesChanged.changed_by.toString(),
        };
    }

    if ("AvatarChanged" in candid) {
        return {
            kind: "avatar_changed",
            changedBy: candid.AvatarChanged.changed_by.toString(),
        };
    }

    if ("UsersBlocked" in candid) {
        return {
            kind: "users_blocked",
            userIds: candid.UsersBlocked.user_ids.map((p) => p.toString()),
            blockedBy: candid.UsersBlocked.blocked_by.toString(),
        };
    }

    if ("UsersUnblocked" in candid) {
        return {
            kind: "users_unblocked",
            userIds: candid.UsersUnblocked.user_ids.map((p) => p.toString()),
            unblockedBy: candid.UsersUnblocked.unblocked_by.toString(),
        };
    }

    if ("RoleChanged" in candid) {
        return {
            kind: "role_changed",
            userIds: candid.RoleChanged.user_ids.map((p) => p.toString()),
            changedBy: candid.RoleChanged.changed_by.toString(),
            oldRole: memberRole(candid.RoleChanged.old_role),
            newRole: memberRole(candid.RoleChanged.new_role),
        };
    }

    if ("MessagePinned" in candid) {
        return {
            kind: "message_pinned",
            pinnedBy: candid.MessagePinned.pinned_by.toString(),
            messageIndex: candid.MessagePinned.message_index,
        };
    }

    if ("MessageUnpinned" in candid) {
        return {
            kind: "message_unpinned",
            unpinnedBy: candid.MessageUnpinned.unpinned_by.toString(),
            messageIndex: candid.MessageUnpinned.message_index,
        };
    }

    if ("PermissionsChanged" in candid) {
        return {
            kind: "permissions_changed",
            oldPermissions: groupPermissions(candid.PermissionsChanged.old_permissions_v2),
            newPermissions: groupPermissions(candid.PermissionsChanged.new_permissions_v2),
            changedBy: candid.PermissionsChanged.changed_by.toString(),
        };
    }

    if ("GroupVisibilityChanged" in candid) {
        return {
            kind: "group_visibility_changed",
            nowPublic: candid.GroupVisibilityChanged.now_public,
            changedBy: candid.GroupVisibilityChanged.changed_by.toString(),
        };
    }

    if ("GroupInviteCodeChanged" in candid) {
        let change: GroupInviteCodeChange = "disabled";
        if ("Enabled" in candid.GroupInviteCodeChanged.change) {
            change = "enabled";
        } else if ("Reset" in candid.GroupInviteCodeChanged.change) {
            change = "reset";
        }

        return {
            kind: "group_invite_code_changed",
            change,
            changedBy: candid.GroupInviteCodeChanged.changed_by.toString(),
        };
    }

    if ("ChatFrozen" in candid) {
        return {
            kind: "chat_frozen",
            frozenBy: candid.ChatFrozen.frozen_by.toString(),
            reason: optional(candid.ChatFrozen.reason, identity),
        };
    }

    if ("ChatUnfrozen" in candid) {
        return {
            kind: "chat_unfrozen",
            unfrozenBy: candid.ChatUnfrozen.unfrozen_by.toString(),
        };
    }

    if ("EventsTimeToLiveUpdated" in candid) {
        return {
            kind: "events_ttl_updated",
            updatedBy: candid.EventsTimeToLiveUpdated.updated_by.toString(),
            newTimeToLive: optional(candid.EventsTimeToLiveUpdated.new_ttl, identity),
        };
    }

    if ("GroupGateUpdated" in candid) {
        return {
            kind: "gate_updated",
            updatedBy: candid.GroupGateUpdated.updated_by.toString(),
        };
    }

    if ("MembersAddedToDefaultChannel" in candid) {
        return {
            kind: "members_added_to_default_channel",
            count: candid.MembersAddedToDefaultChannel.count,
        };
    }

    if ("Empty" in candid) {
        return { kind: "empty" };
    }

    throw new UnsupportedValueError("Unexpected ApiEventWrapper type received", candid);
}

function event(candid: ApiEventWrapper): EventWrapper<GroupChatEvent> {
    return {
        event: groupChatEvent(candid.event),
        index: candid.index,
        timestamp: candid.timestamp,
        expiresAt: optional(candid.expires_at, Number),
    };
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