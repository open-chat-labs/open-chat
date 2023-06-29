import type {
    ApiEventsResponse,
    ApiEventWrapper,
    ApiGroupChatEvent,
    ApiChangeRoleResponse,
    ApiRemoveParticipantResponse,
    ApiSendMessageResponse,
    ApiRole,
    ApiMessagesByMessageIndexResponse,
    ApiMessageEventWrapper,
    ApiSearchGroupChatResponse,
    ApiMakePrivateResponse,
    ApiInviteCodeResponse,
    ApiEnableInviteCodeResponse,
    ApiDisableInviteCodeResponse,
    ApiResetInviteCodeResponse,
    ApiRegisterPollVoteResponse,
    ApiRegisterProposalVoteResponse,
    ApiGroupRules,
    ApiRulesResponse,
    ApiGroupCanisterGroupChatSummary,
    ApiGroupCanisterGroupChatSummaryUpdates,
    ApiGroupCanisterSummaryResponse,
    ApiGroupCanisterSummaryUpdatesResponse,
    ApiClaimPrizeResponse,
    ApiGroupGateUpdate,
} from "./candid/idl";
import type {
    ApiEventsResponse as ApiCommunityEventsResponse,
    ApiMessagesByMessageIndexResponse as ApiCommunityMessagesByMessageIndexResponse,
} from "../community/candid/idl";
import {
    EventsResponse,
    EventWrapper,
    GroupChatEvent,
    SendMessageResponse,
    RemoveMemberResponse,
    BlockUserResponse,
    ChangeRoleResponse,
    UnblockUserResponse,
    MemberRole,
    Message,
    MakeGroupPrivateResponse,
    InviteCodeResponse,
    EnableInviteCodeResponse,
    DisableInviteCodeResponse,
    ResetInviteCodeResponse,
    GroupInviteCodeChange,
    RegisterPollVoteResponse,
    RegisterProposalVoteResponse,
    AccessRules,
    ChatPermissions,
    SearchGroupChatResponse,
    codeToText,
    UnsupportedValueError,
    GroupCanisterGroupChatSummary,
    GroupCanisterGroupChatSummaryUpdates,
    GroupCanisterSummaryResponse,
    GroupCanisterSummaryUpdatesResponse,
    ClaimPrizeResponse,
    UpdatedEvent,
    GroupChatIdentifier,
    ChatIdentifier,
    MultiUserChatIdentifier,
} from "openchat-shared";
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
} from "../common/chatMappers";
import { ensureReplicaIsUpToDate } from "../common/replicaUpToDateChecker";
import type { ApiBlockUserResponse, ApiUnblockUserResponse } from "../group/candid/idl";
import { messageMatch } from "../user/mappers";
import { identity, optional, optionUpdate } from "../../utils/mapping";
import { ReplicaNotUpToDateError } from "../error";
import type { OptionalGroupPermissions } from "./candid/types";

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

export function claimPrizeResponse(candid: ApiClaimPrizeResponse): ClaimPrizeResponse {
    if ("PrizeFullyClaimed" in candid) {
        return { kind: "prize_fully_claimed" };
    }
    if ("MessageNotFound" in candid) {
        return { kind: "message_not_found" };
    }
    if ("CallerNotInGroup" in candid) {
        return { kind: "caller_not_in_group" };
    }
    if ("ChatFrozen" in candid) {
        return { kind: "chat_frozen" };
    }
    if ("AlreadyClaimed" in candid) {
        return { kind: "already_claimed" };
    }
    if ("Success" in candid) {
        return { kind: "success" };
    }
    if ("UserSuspended" in candid) {
        return { kind: "user_suspended" };
    }
    if ("PrizeEnded" in candid) {
        return { kind: "prize_ended" };
    }
    if ("FailedAfterTransfer" in candid) {
        return { kind: "failed_after_transfer" };
    }
    if ("TransferFailed" in candid) {
        return { kind: "transfer_failed" };
    }
    throw new UnsupportedValueError("Unexpected ApiClaimPrizeResponse type received", candid);
}

export function summaryResponse(
    candid: ApiGroupCanisterSummaryResponse
): GroupCanisterSummaryResponse {
    if ("Success" in candid) {
        return groupChatSummary(candid.Success.summary);
    }
    if ("CallerNotInGroup" in candid) {
        return { kind: "caller_not_in_group" };
    }
    throw new UnsupportedValueError(
        "Unexpected ApiGroupCanisterSummaryResponse type received",
        candid
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
        joined: candid.joined,
        memberCount: candid.participant_count,
        myRole: memberRole(candid.role),
        mentions: candid.mentions
            .filter((m) => m.thread_root_message_index.length === 0)
            .map(mention),
        permissions: groupPermissions(candid.permissions),
        notificationsMuted: candid.notifications_muted,
        metrics: chatMetrics(candid.metrics),
        myMetrics: chatMetrics(candid.my_metrics),
        latestThreads: candid.latest_threads.map(threadDetails),
        frozen: candid.frozen.length > 0,
        dateLastPinned: optional(candid.date_last_pinned, identity),
        gate: optional(candid.gate, accessGate) ?? { kind: "no_gate" },
    };
}

export function summaryUpdatesResponse(
    candid: ApiGroupCanisterSummaryUpdatesResponse
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
        candid
    );
}

function groupChatSummaryUpdates(
    candid: ApiGroupCanisterGroupChatSummaryUpdates
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
        memberCount: optional(candid.participant_count, identity),
        myRole: optional(candid.role, memberRole),
        mentions: candid.mentions
            .filter((m) => m.thread_root_message_index.length === 0)
            .map(mention),
        permissions: optional(candid.permissions, groupPermissions),
        notificationsMuted: optional(candid.notifications_muted, identity),
        metrics: optional(candid.metrics, chatMetrics),
        myMetrics: optional(candid.my_metrics, chatMetrics),
        latestThreads: candid.latest_threads.map(threadDetails),
        frozen: optionUpdate(candid.frozen, (_) => true),
        updatedEvents: candid.updated_events.map(updatedEvent),
        dateLastPinned: optional(candid.date_last_pinned, identity),
        gate: optionUpdate(candid.gate, accessGate),
    };
}

function updatedEvent([threadRootMessageIndex, eventIndex, timestamp]: [
    [] | [number],
    number,
    bigint
]): UpdatedEvent {
    return {
        eventIndex,
        threadRootMessageIndex: optional(threadRootMessageIndex, identity),
        timestamp,
    };
}

export function apiOptionalGroupPermissions(
    permissions: Partial<ChatPermissions>
): OptionalGroupPermissions {
    return {
        block_users: apiOptional(apiPermissionRole, permissions.blockUsers),
        change_permissions: apiOptional(apiPermissionRole, permissions.changePermissions),
        delete_messages: apiOptional(apiPermissionRole, permissions.deleteMessages),
        send_messages: apiOptional(apiPermissionRole, permissions.sendMessages),
        remove_members: apiOptional(apiPermissionRole, permissions.removeMembers),
        update_group: apiOptional(apiPermissionRole, permissions.updateGroup),
        invite_users: apiOptional(apiPermissionRole, permissions.inviteUsers),
        change_roles: apiOptional(apiPermissionRole, permissions.changeRoles),
        create_polls: apiOptional(apiPermissionRole, permissions.createPolls),
        pin_messages: apiOptional(apiPermissionRole, permissions.pinMessages),
        reply_in_thread: apiOptional(apiPermissionRole, permissions.replyInThread),
        react_to_messages: apiOptional(apiPermissionRole, permissions.reactToMessages),
    };
}

export function apiGroupRules(rules: AccessRules): ApiGroupRules {
    return {
        text: rules.text,
        enabled: rules.enabled,
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

    throw new UnsupportedValueError("Unexpected ApiSendMessageResponse type received", candid);
}

export function removeMemberResponse(candid: ApiRemoveParticipantResponse): RemoveMemberResponse {
    if ("Success" in candid) {
        return "success";
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
    if ("CannotRemoveSelf" in candid) {
        return "cannot_remove_self";
    }
    if ("CannotRemoveUser" in candid) {
        return "cannot_remove_user";
    }
    if ("UserSuspended" in candid) {
        return "user_suspended";
    }
    if ("ChatFrozen" in candid) {
        return "chat_frozen";
    }
    if ("InternalError" in candid) {
        return "internal_error";
    }
    throw new UnsupportedValueError(
        "Unexpected ApiRemoveParticipantResponse type received",
        candid
    );
}

export async function getMessagesByMessageIndexResponse(
    principal: Principal,
    candid: ApiMessagesByMessageIndexResponse | ApiCommunityMessagesByMessageIndexResponse,
    chatId: MultiUserChatIdentifier,
    threadRootMessageIndex: number | undefined,
    latestClientEventIndexPreRequest: number | undefined
): Promise<EventsResponse<Message>> {
    if ("Success" in candid) {
        const latestEventIndex = candid.Success.latest_event_index;

        await ensureReplicaIsUpToDate(
            principal,
            chatId,
            threadRootMessageIndex,
            latestClientEventIndexPreRequest,
            latestEventIndex
        );

        return {
            events: candid.Success.messages.map(messageWrapper),
            latestEventIndex,
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
        throw ReplicaNotUpToDateError.byEventIndex(
            candid.ReplicaNotUpToDate,
            latestClientEventIndexPreRequest ?? -1,
            false
        );
    }
    throw new UnsupportedValueError(
        "Unexpected ApiMessagesByMessageIndexResponse type received",
        candid
    );
}

export function messageWrapper(candid: ApiMessageEventWrapper): EventWrapper<Message> {
    return {
        event: message(candid.event),
        timestamp: candid.timestamp,
        index: candid.index,
    };
}

export async function getEventsResponse(
    principal: Principal,
    candid: ApiEventsResponse | ApiCommunityEventsResponse,
    chatId: ChatIdentifier,
    threadRootMessageIndex: number | undefined,
    latestClientEventIndexPreRequest: number | undefined
): Promise<EventsResponse<GroupChatEvent>> {
    if ("Success" in candid) {
        const latestEventIndex = candid.Success.latest_event_index;

        await ensureReplicaIsUpToDate(
            principal,
            chatId,
            threadRootMessageIndex,
            latestClientEventIndexPreRequest,
            latestEventIndex
        );

        return {
            events: candid.Success.events.map(event),
            latestEventIndex,
        };
    }
    if ("ChatNotFound" in candid) {
        return "events_failed";
    }
    if ("ThreadNotFound" in candid) {
        return "events_failed";
    }
    if ("CallerNotInGroup" in candid) {
        return "events_failed";
    }
    if ("ThreadMessageNotFound" in candid) {
        return "events_failed";
    }
    if ("ReplicaNotUpToDate" in candid) {
        throw ReplicaNotUpToDateError.byEventIndex(
            candid.ReplicaNotUpToDate,
            latestClientEventIndexPreRequest ?? -1,
            false
        );
    }
    if ("UserNotInChannel" in candid) {
        return "events_failed";
    }
    if ("UserNotInCommunity" in candid) {
        return "events_failed";
    }
    if ("ChannelNotFound" in candid) {
        return "events_failed";
    }
    throw new UnsupportedValueError("Unexpected ApiEventsResponse type received", candid);
}

export function searchGroupChatResponse(
    candid: ApiSearchGroupChatResponse,
    chatId: GroupChatIdentifier
): SearchGroupChatResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            matches: candid.Success.matches.map((m) => messageMatch(m, chatId)),
        };
    }
    if ("TermTooShort" in candid || "TermTooLong" in candid || "InvalidTerm" in candid) {
        return {
            kind: "term_invalid",
        };
    }
    if ("TooManyUsers" in candid) {
        return {
            kind: "too_many_users",
        };
    }
    if ("CallerNotInGroup" in candid) {
        return {
            kind: "caller_not_in_group",
        };
    }
    throw new UnsupportedValueError(
        "Unexpected UserIndex.ApiSearchMessagesResponse type received",
        candid
    );
}

export function inviteCodeResponse(candid: ApiInviteCodeResponse): InviteCodeResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            code: optional(candid.Success.code, codeToText),
        };
    }
    if ("NotAuthorized" in candid) {
        return {
            kind: "not_authorized",
        };
    }
    throw new UnsupportedValueError("Unexpected Group.ApiInviteCodeResponse type received", candid);
}

export function enableInviteCodeResponse(
    candid: ApiEnableInviteCodeResponse
): EnableInviteCodeResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            code: codeToText(candid.Success.code),
        };
    }
    if ("NotAuthorized" in candid) {
        return {
            kind: "not_authorized",
        };
    }
    if ("UserSuspended" in candid) {
        return {
            kind: "user_suspended",
        };
    }
    if ("ChatFrozen" in candid) {
        return { kind: "chat_frozen" };
    }
    throw new UnsupportedValueError(
        "Unexpected Group.ApiEnableInviteCodeResponse type received",
        candid
    );
}

export function disableInviteCodeResponse(
    candid: ApiDisableInviteCodeResponse
): DisableInviteCodeResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("NotAuthorized" in candid) {
        return "not_authorized";
    }
    if ("UserSuspended" in candid) {
        return "user_suspended";
    }
    if ("ChatFrozen" in candid) {
        return "chat_frozen";
    }
    throw new UnsupportedValueError(
        "Unexpected ApiDisableInviteCodeResponse type received",
        candid
    );
}

export function resetInviteCodeResponse(
    candid: ApiResetInviteCodeResponse
): ResetInviteCodeResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            code: codeToText(candid.Success.code),
        };
    }
    if ("NotAuthorized" in candid) {
        return {
            kind: "not_authorized",
        };
    }
    if ("UserSuspended" in candid) {
        return {
            kind: "user_suspended",
        };
    }
    if ("ChatFrozen" in candid) {
        return { kind: "chat_frozen" };
    }
    throw new UnsupportedValueError(
        "Unexpected Group.ApiResetInviteCodeResponse type received",
        candid
    );
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
            oldPermissions: groupPermissions(candid.PermissionsChanged.old_permissions),
            newPermissions: groupPermissions(candid.PermissionsChanged.new_permissions),
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
    };
}

export function registerProposalVoteResponse(
    candid: ApiRegisterProposalVoteResponse
): RegisterProposalVoteResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("AlreadyVoted" in candid) {
        return "already_voted";
    }
    if ("CallerNotInGroup" in candid) {
        return "caller_not_in_group";
    }
    if ("NoEligibleNeurons" in candid) {
        return "no_eligible_neurons";
    }
    if ("ProposalNotAcceptingVotes" in candid) {
        return "proposal_not_accepting_votes";
    }
    if ("ProposalNotFound" in candid) {
        return "proposal_not_found";
    }
    if ("ProposalMessageNotFound" in candid) {
        return "proposal_message_not_found";
    }
    if ("UserSuspended" in candid) {
        return "user_suspended";
    }
    if ("ChatFrozen" in candid) {
        return "chat_frozen";
    }
    if ("InternalError" in candid) {
        return "internal_error";
    }
    throw new UnsupportedValueError("Unexpected ApiVoteOnProposalResponse type received", candid);
}

export function rulesResponse(candid: ApiRulesResponse): AccessRules | undefined {
    if ("Success" in candid) {
        const rules = optional(candid.Success.rules, identity);
        return {
            text: rules ?? "",
            enabled: rules !== undefined,
        };
    }
}
