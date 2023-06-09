import {
    AddMembersToChannelResponse,
    AddReactionResponse,
    BlockCommunityUserResponse,
    ChangeChannelRoleResponse,
    ChangeCommunityRoleResponse,
    CommonResponses,
    CommunityPermissionRole,
    CommunityPermissions,
    CreateChannelResponse,
    DeclineChannelInvitationResponse,
    GateCheckFailedReason,
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
    ApiEventsResponse,
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
} from "./candid/idl";
import { apiOptional } from "../common/chatMappers";
import type { ApiGateCheckFailedReason } from "../localUserIndex/candid/idl";

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

export function deleteChannelResponse(_candid: ApiDeleteChannelResponse): unknown {
    return {};
}

export function deleteMessagesResponse(_candid: ApiDeleteMessagesResponse): unknown {
    return {};
}

export function deleteMessageResponse(_candid: ApiDeletedMessageResponse): unknown {
    return {};
}

export function disableInviteCodeResponse(_candid: ApiDisableInviteCodeResponse): unknown {
    return {};
}

export function editMessageResponse(_candid: ApiEditMessageResponse): unknown {
    return {};
}

export function enableInviteCodeResponse(_candid: ApiEnableInviteCodeResponse): unknown {
    return {};
}

export function eventsResponse(_candid: ApiEventsResponse): unknown {
    return {};
}

export function inviteCodeResponse(_candid: ApiInviteCodeResponse): unknown {
    return {};
}

export function joinChannelResponse(_candid: ApiJoinChannelResponse): unknown {
    return {};
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
