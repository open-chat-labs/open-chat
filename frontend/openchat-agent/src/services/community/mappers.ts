import {
    AddMembersToChannelResponse,
    AddReactionResponse,
    BlockCommunityUserResponse,
    ChangeChannelRoleResponse,
    ChangeCommunityRoleResponse,
    CommonResponses,
    CommunityInviteCodeResponse,
    CommunityPermissionRole,
    CommunityPermissions,
    CreateChannelResponse,
    DeclineChannelInvitationResponse,
    DeleteChannelMessageResponse,
    DeleteChannelMessagesResponse,
    DeleteChannelResponse,
    DisableCommunityInviteCodeResponse,
    EditChannelMessageResponse,
    EnableCommunityInviteCodeResponse,
    GateCheckFailedReason,
    GroupChatSummary,
    JoinChannelResponse,
    MemberRole,
    UnsupportedValueError,
    UserFailedError,
    UserFailedGateCheck,
} from "openchat-shared";
import type {
    ApiAddReactionResponse,
    ApiAddMembersToChannelResponse,
    ApiBlockUserResponse,
    ApiChangeChannelRoleResponse,
    ApiChangeRoleResponse,
    ApiCreateChannelResponse,
    ApiDeclineInvitationResponse,
    ApiDeleteChannelResponse,
    ApiDeleteMessagesResponse,
    ApiDeletedMessageResponse,
    ApiDisableInviteCodeResponse,
    ApiEditMessageResponse,
    ApiInviteCodeResponse,
    ApiJoinChannelResponse,
    ApiLeaveChannelResponse,
    ApiLocalUserIndexResponse,
    ApiMakeChannelPrivateResponse,
    ApiMakePrivateResponse,
    ApiMessagesByMessageIndexResponse,
    ApiPinMessageResponse,
    ApiRemoveMemberResponse,
    ApiRemoveMemberFromChannelResponse,
    ApiRemoveReactionResponse,
    ApiEnableInviteCodeResponse,
    ApiRulesResponse,
    ApiSearchChannelResponse,
    ApiSelectedChannelInitialResponse,
    ApiSelectedChannelUpdatesResponse,
    ApiSendMessageResponse,
    ApiSummaryResponse,
    ApiSummaryUpdatesResponse,
    ApiToggleMuteChannelNotificationsResponse,
    ApiToggleMuteNotificationsResponse,
    ApiUnblockUserResponse,
    ApiUndeleteMessagesResponse,
    ApiUpdateChannelResponse,
    ApiUpdateCommunityResponse,
    ApiGroupRole,
    ApiCommunityRole,
    ApiOptionalCommunityPermissions,
    ApiCommunityPermissionRole,
    ApiAddMembersToChannelFailed,
    ApiAddMembersToChannelPartialSuccess,
    ApiUserFailedGateCheck,
    ApiUserFailedError,
    ApiCommunityCanisterChannelSummary,
} from "./candid/idl";
import {
    accessGate,
    apiGroupSubtype,
    apiOptional,
    chatMetrics,
    gateCheckFailedReason,
    groupPermissions,
    memberRole,
    message,
    messageContent,
} from "../common/chatMappers";
import type { ApiGateCheckFailedReason } from "../localUserIndex/candid/idl";
import { identity, optional } from "../../utils/mapping";

export function addMembersToChannelResponse(
    candid: ApiAddMembersToChannelResponse
): AddMembersToChannelResponse {
    if ("Failed" in candid) {
        return addToChannelFailed(candid.Failed);
    }
    if ("UserNotInChannel" in candid) {
        return CommonResponses.userNotInChannel;
    }
    if ("PartialSuccess" in candid) {
        return addToChannelPartialSuccess(candid.PartialSuccess);
    }
    if ("ChannelNotFound" in candid) {
        return CommonResponses.channelNotFound;
    }
    if ("UserLimitReached" in candid) {
        return CommonResponses.userLimitReached;
    }
    if ("NotAuthorized" in candid) {
        return CommonResponses.notAuthorized;
    }
    if ("Success" in candid) {
        return CommonResponses.success;
    }
    if ("UserNotInCommunity" in candid) {
        return CommonResponses.userNotInCommunity;
    }
    if ("UserSuspended" in candid) {
        return CommonResponses.userSuspended;
    }
    if ("CommunityFrozen" in candid) {
        return CommonResponses.communityFrozen;
    }
    throw new UnsupportedValueError(
        "Unexpected ApiAddMembersToChannelResponse type received",
        candid
    );
}

function addToChannelFailed(candid: ApiAddMembersToChannelFailed): AddMembersToChannelResponse {
    return {
        kind: "add_to_channel_failed",
        usersLimitReached: candid.users_limit_reached.map((u) => u.toString()),
        usersAlreadyInChannel: candid.users_already_in_channel.map((u) => u.toString()),
        usersFailedGateCheck: candid.users_failed_gate_check.map(userFailedGateCheck),
        usersFailedWithError: candid.users_failed_with_error.map(userFailedWithError),
    };
}

function userFailedWithError(candid: ApiUserFailedError): UserFailedError {
    return {
        userId: candid.user_id.toString(),
        error: candid.error,
    };
}

function userFailedGateCheck(candid: ApiUserFailedGateCheck): UserFailedGateCheck {
    return {
        userId: candid.user_id.toString(),
        reason: failedGateCheckReason(candid.reason),
    };
}

function failedGateCheckReason(candid: ApiGateCheckFailedReason): GateCheckFailedReason {
    if ("NotDiamondMember" in candid) {
        return "not_diamond";
    }
    if ("NoSnsNeuronsFound" in candid) {
        return "no_sns_neuron_found";
    }
    if ("NoSnsNeuronsWithRequiredDissolveDelayFound" in candid) {
        return "dissolve_delay_not_met";
    }
    if ("NoSnsNeuronsWithRequiredStakeFound" in candid) {
        return "min_stake_not_met";
    }
    throw new UnsupportedValueError("Unexpected ApiGateCheckFailedReason type received", candid);
}

function addToChannelPartialSuccess(
    candid: ApiAddMembersToChannelPartialSuccess
): AddMembersToChannelResponse {
    return {
        kind: "add_to_channel_partial_success",
        usersLimitReached: candid.users_limit_reached.map((u) => u.toString()),
        usersAlreadyInChannel: candid.users_already_in_channel.map((u) => u.toString()),
        usersFailedGateCheck: candid.users_failed_gate_check.map(userFailedGateCheck),
        usersFailedWithError: candid.users_failed_with_error.map(userFailedWithError),
        usersAdded: candid.users_added.map((u) => u.toString()),
    };
}

export function addReactionResponse(candid: ApiAddReactionResponse): AddReactionResponse {
    if ("UserNotInChannel" in candid) {
        return CommonResponses.userNotInChannel;
    }
    if ("MessageNotFound" in candid) {
        return CommonResponses.messageNotFound;
    }
    if ("NoChange" in candid) {
        return CommonResponses.noChange;
    }
    if ("ChannelNotFound" in candid) {
        return CommonResponses.channelNotFound;
    }
    if ("NotAuthorized" in candid) {
        return CommonResponses.notAuthorized;
    }
    if ("Success" in candid) {
        return CommonResponses.success;
    }
    if ("UserNotInCommunity" in candid) {
        return CommonResponses.userNotInCommunity;
    }
    if ("UserSuspended" in candid) {
        return CommonResponses.userSuspended;
    }
    if ("CommunityFrozen" in candid) {
        return CommonResponses.communityFrozen;
    }
    if ("InvalidReaction" in candid) {
        return { kind: "invalid_reaction" };
    }
    throw new UnsupportedValueError("Unexpected ApiAddReactionResponse type received", candid);
}

export function blockUserResponse(candid: ApiBlockUserResponse): BlockCommunityUserResponse {
    if ("NotAuthorized" in candid) {
        return CommonResponses.notAuthorized;
    }
    if ("Success" in candid) {
        return CommonResponses.success;
    }
    if ("UserNotInCommunity" in candid) {
        return CommonResponses.userNotInCommunity;
    }
    if ("CommunityNotPublic" in candid) {
        return CommonResponses.communityNotPublic;
    }
    if ("UserSuspended" in candid) {
        return CommonResponses.userSuspended;
    }
    if ("CommunityFrozen" in candid) {
        return CommonResponses.communityFrozen;
    }
    if ("TargetUserNotInCommunity" in candid) {
        return CommonResponses.targetUserNotInCommunity;
    }
    if ("InternalError" in candid) {
        return CommonResponses.internalError;
    }
    if ("CannotBlockSelf" in candid) {
        return { kind: "cannot_block_self" };
    }
    if ("CannotBlockUser" in candid) {
        return { kind: "cannot_block_user" };
    }
    throw new UnsupportedValueError("Unexpected ApiBlockUserResponse type received", candid);
}

export function changeChannelRoleResponse(
    candid: ApiChangeChannelRoleResponse
): ChangeChannelRoleResponse {
    if ("Invalid" in candid) {
        return CommonResponses.invalid;
    }
    if ("UserNotInChannel" in candid) {
        return CommonResponses.userNotInChannel;
    }
    if ("ChannelNotFound" in candid) {
        return CommonResponses.channelNotFound;
    }
    if ("NotAuthorized" in candid) {
        return CommonResponses.notAuthorized;
    }
    if ("Success" in candid) {
        return CommonResponses.success;
    }
    if ("UserNotInCommunity" in candid) {
        return CommonResponses.userNotInCommunity;
    }
    if ("UserSuspended" in candid) {
        return CommonResponses.userSuspended;
    }
    if ("CommunityFrozen" in candid) {
        return CommonResponses.communityFrozen;
    }
    if ("TargetUserNotInChannel" in candid) {
        return { kind: "target_user_not_in_channel" };
    }
    throw new UnsupportedValueError(
        "Unexpected ApiChangeChannelRoleResponse type received",
        candid
    );
}

export function changeRoleResponse(candid: ApiChangeRoleResponse): ChangeCommunityRoleResponse {
    if ("Invalid" in candid) {
        return CommonResponses.invalid;
    }
    if ("NotAuthorized" in candid) {
        return CommonResponses.notAuthorized;
    }
    if ("Success" in candid) {
        return CommonResponses.success;
    }
    if ("UserNotInCommunity" in candid) {
        return CommonResponses.userNotInCommunity;
    }
    if ("UserSuspended" in candid) {
        return CommonResponses.userSuspended;
    }
    if ("CommunityFrozen" in candid) {
        return CommonResponses.communityFrozen;
    }
    if ("TargetUserNotInCommunity" in candid) {
        return CommonResponses.targetUserNotInCommunity;
    }
    if ("InternalError" in candid) {
        return CommonResponses.internalError;
    }
    throw new UnsupportedValueError("Unexpected ApiChangeRoleResponse type received", candid);
}

export function createChannelResponse(candid: ApiCreateChannelResponse): CreateChannelResponse {
    if ("MaxChannelsCreated" in candid) {
        return { kind: "max_channels_created" };
    }
    if ("NameReserved" in candid) {
        return { kind: "name_reserved" };
    }
    if ("RulesTooLong" in candid) {
        return { kind: "rules_too_long" };
    }
    if ("DescriptionTooLong" in candid) {
        return { kind: "description_too_long" };
    }
    if ("NameTooShort" in candid) {
        return { kind: "name_too_short" };
    }
    if ("NotAuthorized" in candid) {
        return CommonResponses.notAuthorized;
    }
    if ("AvatarTooBig" in candid) {
        return { kind: "avatar_too_big" };
    }
    if ("Success" in candid) {
        return { kind: "success", channelId: candid.Success.channel_id.toString() };
    }
    if ("UserSuspended" in candid) {
        return CommonResponses.userSuspended;
    }
    if ("RulesTooShort" in candid) {
        return { kind: "rules_too_short" };
    }
    if ("CommunityFrozen" in candid) {
        return CommonResponses.communityFrozen;
    }
    if ("NameTooLong" in candid) {
        return { kind: "name_too_long" };
    }
    if ("NameTaken" in candid) {
        return { kind: "name_taken" };
    }
    throw new UnsupportedValueError("Unexpected ApiCreateChannelResponse type received", candid);
}

export function declineInvitationResponse(
    candid: ApiDeclineInvitationResponse
): DeclineChannelInvitationResponse {
    if ("NotInvited" in candid) {
        return { kind: "not_invited" };
    }
    if ("ChannelNotFound" in candid) {
        return CommonResponses.channelNotFound;
    }
    if ("Success" in candid) {
        return CommonResponses.success;
    }
    if ("UserNotInCommunity" in candid) {
        return CommonResponses.userNotInCommunity;
    }
    throw new UnsupportedValueError(
        "Unexpected ApiDeclineInvitationResponse type received",
        candid
    );
}

export function deleteChannelResponse(candid: ApiDeleteChannelResponse): DeleteChannelResponse {
    if ("UserNotInChannel" in candid) {
        return CommonResponses.userNotInChannel;
    }
    if ("ChannelNotFound" in candid) {
        return CommonResponses.channelNotFound;
    }
    if ("NotAuthorized" in candid) {
        return CommonResponses.notAuthorized;
    }
    if ("Success" in candid) {
        return CommonResponses.success;
    }
    if ("UserNotInCommunity" in candid) {
        return CommonResponses.userNotInCommunity;
    }
    if ("UserSuspended" in candid) {
        return CommonResponses.userSuspended;
    }
    if ("CommunityFrozen" in candid) {
        return CommonResponses.communityFrozen;
    }
    throw new UnsupportedValueError("Unexpected ApiDeleteChannelResponse type received", candid);
}

export function deleteMessagesResponse(
    candid: ApiDeleteMessagesResponse
): DeleteChannelMessagesResponse {
    if ("UserNotInChannel" in candid) {
        return CommonResponses.userNotInChannel;
    }
    if ("MessageNotFound" in candid) {
        return CommonResponses.messageNotFound;
    }
    if ("ChannelNotFound" in candid) {
        return CommonResponses.channelNotFound;
    }
    if ("Success" in candid) {
        return CommonResponses.success;
    }
    if ("UserNotInCommunity" in candid) {
        return CommonResponses.userNotInCommunity;
    }
    if ("UserSuspended" in candid) {
        return CommonResponses.userSuspended;
    }
    if ("CommunityFrozen" in candid) {
        return CommonResponses.communityFrozen;
    }
    if ("NotPlatformModerator" in candid) {
        return CommonResponses.notPlatformModerator;
    }
    if ("InternalError" in candid) {
        return CommonResponses.internalError;
    }

    throw new UnsupportedValueError("Unexpected ApiDeleteMessagesResponse type received", candid);
}

export function deleteMessageResponse(
    candid: ApiDeletedMessageResponse,
    sender: string
): DeleteChannelMessageResponse {
    if ("UserNotInChannel" in candid) {
        return CommonResponses.userNotInChannel;
    }
    if ("MessageNotFound" in candid) {
        return CommonResponses.messageNotFound;
    }
    if ("ChannelNotFound" in candid) {
        return CommonResponses.channelNotFound;
    }
    if ("NotAuthorized" in candid) {
        return CommonResponses.notAuthorized;
    }
    if ("Success" in candid) {
        return { kind: "success", content: messageContent(candid.Success.content, sender) };
    }
    if ("UserNotInCommunity" in candid) {
        return CommonResponses.userNotInCommunity;
    }
    if ("MessageHardDeleted" in candid) {
        return { kind: "message_hard_deleted" };
    }
    if ("MessageNotDeleted" in candid) {
        return { kind: "message_not_deleted" };
    }
    throw new UnsupportedValueError("Unexpected ApiDeleteMessageResponse type received", candid);
}

export function disableInviteCodeResponse(
    candid: ApiDisableInviteCodeResponse
): DisableCommunityInviteCodeResponse {
    if ("NotAuthorized" in candid) {
        return CommonResponses.notAuthorized;
    }
    if ("Success" in candid) {
        return CommonResponses.success;
    }
    if ("UserSuspended" in candid) {
        return CommonResponses.userSuspended;
    }
    if ("CommunityFrozen" in candid) {
        return CommonResponses.communityFrozen;
    }
    throw new UnsupportedValueError(
        "Unexpected ApiDisableInviteCodeResponse type received",
        candid
    );
}

export function editMessageResponse(candid: ApiEditMessageResponse): EditChannelMessageResponse {
    if ("UserNotInChannel" in candid) {
        return CommonResponses.userNotInChannel;
    }
    if ("MessageNotFound" in candid) {
        return CommonResponses.messageNotFound;
    }
    if ("ChannelNotFound" in candid) {
        return CommonResponses.channelNotFound;
    }
    if ("Success" in candid) {
        return CommonResponses.success;
    }
    if ("UserNotInCommunity" in candid) {
        return CommonResponses.userNotInCommunity;
    }
    if ("UserSuspended" in candid) {
        return CommonResponses.userSuspended;
    }
    if ("CommunityFrozen" in candid) {
        return CommonResponses.communityFrozen;
    }
    throw new UnsupportedValueError("Unexpected ApiEditMessageResponse type received", candid);
}

export function enableInviteCodeResponse(
    candid: ApiEnableInviteCodeResponse
): EnableCommunityInviteCodeResponse {
    if ("NotAuthorized" in candid) {
        return CommonResponses.notAuthorized;
    }
    if ("Success" in candid) {
        return { kind: "success", code: candid.Success.code };
    }
    if ("UserSuspended" in candid) {
        return CommonResponses.userSuspended;
    }
    if ("CommunityFrozen" in candid) {
        return CommonResponses.communityFrozen;
    }
    throw new UnsupportedValueError("Unexpected ApiEnableInviteCodeResponse type received", candid);
}

export function inviteCodeResponse(candid: ApiInviteCodeResponse): CommunityInviteCodeResponse {
    if ("NotAuthorized" in candid) {
        return CommonResponses.notAuthorized;
    }
    if ("Success" in candid) {
        return { kind: "success", code: optional(candid.Success.code, identity) };
    }
    if ("UserNotInCommunity" in candid) {
        return CommonResponses.userNotInCommunity;
    }
    throw new UnsupportedValueError("Unexpected ApiEnableInviteCodeResponse type received", candid);
}

export function joinChannelResponse(candid: ApiJoinChannelResponse): JoinChannelResponse {
    if ("NotInvited" in candid) {
        return { kind: "not_invited" };
    }
    if ("AlreadyInChannel" in candid) {
        return { kind: "already_in_channel" };
    }
    if ("GateCheckFailed" in candid) {
        return { kind: "gate_check_failed", reason: gateCheckFailedReason(candid.GateCheckFailed) };
    }
    if ("ChannelNotFound" in candid) {
        return CommonResponses.channelNotFound;
    }
    if ("UserLimitReached" in candid) {
        return CommonResponses.userLimitReached;
    }
    if ("Success" in candid) {
        return { kind: "success", channel: groupChatSummary(candid.Success) };
    }
    if ("UserNotInCommunity" in candid) {
        return CommonResponses.userNotInCommunity;
    }
    if ("UserSuspended" in candid) {
        return CommonResponses.userSuspended;
    }
    if ("CommunityFrozen" in candid) {
        return CommonResponses.communityFrozen;
    }
    if ("InternalError" in candid) {
        return CommonResponses.internalError;
    }
    if ("UserBlocked" in candid) {
        return CommonResponses.userBlocked;
    }
    throw new UnsupportedValueError("Unexpected ApiJoinChannelResponse type received", candid);
}

export function leaveChannelResponse(_candid: ApiLeaveChannelResponse): unknown {
    return {};
}

export function localUserIndexResponse(_candid: ApiLocalUserIndexResponse): unknown {
    return {};
}

export function makeChannelPrivateResponse(_candid: ApiMakeChannelPrivateResponse): unknown {
    return {};
}

export function makePrivateResponse(_candid: ApiMakePrivateResponse): unknown {
    return {};
}

export function messageByMessageIndexResponse(_candid: ApiMessagesByMessageIndexResponse): unknown {
    return {};
}

export function pinMessageResponse(_candid: ApiPinMessageResponse): unknown {
    return {};
}

export function removeMemberResponse(_candid: ApiRemoveMemberResponse): unknown {
    return {};
}

export function removeMemberFromChannelResponse(
    _candid: ApiRemoveMemberFromChannelResponse
): unknown {
    return {};
}

export function removeReactionResponse(_candid: ApiRemoveReactionResponse): unknown {
    return {};
}

export function resetInviteCodeResponse(_candid: ApiEnableInviteCodeResponse): unknown {
    return {};
}

export function rulesResponse(_candid: ApiRulesResponse): unknown {
    return {};
}

export function searchChannelResponse(_candid: ApiSearchChannelResponse): unknown {
    return {};
}

export function selectedChannelInitialResponse(
    _candid: ApiSelectedChannelInitialResponse
): unknown {
    return {};
}

export function selectedChannelUpdatesResponse(
    _candid: ApiSelectedChannelUpdatesResponse
): unknown {
    return {};
}

export function sendMessageResponse(_candid: ApiSendMessageResponse): unknown {
    return {};
}

export function summaryResponse(_candid: ApiSummaryResponse): unknown {
    return {};
}

export function summaryUpdatesResponse(_candid: ApiSummaryUpdatesResponse): unknown {
    return {};
}

export function toggleMuteChannelNotificationsResponse(
    _candid: ApiToggleMuteChannelNotificationsResponse
): unknown {
    return {};
}

export function toggleMuteNotificationsResponse(
    _candid: ApiToggleMuteNotificationsResponse
): unknown {
    return {};
}

export function unblockUserResponse(_candid: ApiUnblockUserResponse): unknown {
    return {};
}

export function undeleteMessagesResponse(_candid: ApiUndeleteMessagesResponse): unknown {
    return {};
}

export function updateChannelResponse(_candid: ApiUpdateChannelResponse): unknown {
    return {};
}

export function updateCommunityResponse(_candid: ApiUpdateCommunityResponse): unknown {
    return {};
}

export function apiMemberRole(domain: MemberRole): ApiGroupRole {
    switch (domain) {
        case "owner":
            return { Owner: null };
        case "admin":
            return { Admin: null };
        case "moderator":
            return { Moderator: null };
        default:
            return { Participant: null };
    }
}

export function apiCommunityRole(newRole: MemberRole): ApiCommunityRole {
    switch (newRole) {
        case "owner":
            return { Owner: null };
        case "admin":
            return { Admin: null };
        default:
            return { Member: null };
    }
}

export function apiOptionalCommunityPermissions(
    permissions: Partial<CommunityPermissions>
): ApiOptionalCommunityPermissions {
    return {
        create_public_channel: apiOptional(
            apiCommunityPermissionRole,
            permissions.createPublicChannel
        ),
        block_users: apiOptional(apiCommunityPermissionRole, permissions.blockUsers),
        change_permissions: apiOptional(apiCommunityPermissionRole, permissions.changePermissions),
        update_details: apiOptional(apiCommunityPermissionRole, permissions.updateDetails),
        remove_members: apiOptional(apiCommunityPermissionRole, permissions.removeMembers),
        invite_users: apiOptional(apiCommunityPermissionRole, permissions.inviteUsers),
        change_roles: apiOptional(apiCommunityPermissionRole, permissions.changeRoles),
        create_private_channel: apiOptional(
            apiCommunityPermissionRole,
            permissions.createPrivateChannel
        ),
    };
}

export function apiCommunityPermissionRole(
    permissionRole: CommunityPermissionRole
): ApiCommunityPermissionRole {
    switch (permissionRole) {
        case "owner":
            return { Owners: null };
        case "admins":
            return { Admins: null };
        case "members":
            return { Members: null };
    }
}

export function groupChatSummary(candid: ApiCommunityCanisterChannelSummary): GroupChatSummary {
    const latestMessage = optional(candid.latest_message, (ev) => ({
        index: ev.index,
        timestamp: ev.timestamp,
        event: message(ev.event),
    }));
    return {
        kind: "group_chat",
        chatId: candid.channel_id.toString(),
        id: candid.channel_id.toString(),
        latestMessage,
        readByMeUpTo: latestMessage?.event.messageIndex,
        name: candid.name,
        description: candid.description,
        public: candid.is_public,
        historyVisible: candid.history_visible_to_new_joiners,
        joined: candid.joined,
        minVisibleEventIndex: candid.min_visible_event_index,
        minVisibleMessageIndex: candid.min_visible_message_index,
        latestEventIndex: candid.latest_event_index,
        lastUpdated: candid.last_updated,
        blobReference: optional(candid.avatar_id, (blobId) => ({
            blobId,
            canisterId: candid.channel_id.toString(),
        })),
        notificationsMuted: candid.notifications_muted,
        memberCount: 0, //TODO this doesn't exist on commmunity channel
        myRole: memberRole(candid.role),
        mentions: [],
        permissions: groupPermissions(candid.permissions),
        metrics: chatMetrics(candid.metrics),
        myMetrics: chatMetrics(candid.my_metrics),
        latestThreads: [],
        subtype: optional(candid.subtype, apiGroupSubtype),
        archived: false,
        previewed: false,
        frozen: false, // TODO - doesn't exist
        dateLastPinned: optional(candid.date_last_pinned, identity),
        dateReadPinned: undefined,
        gate: optional(candid.gate, accessGate) ?? { kind: "no_gate" },
        level: "group",
    };
}
