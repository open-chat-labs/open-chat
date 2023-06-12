import {
    AddMembersToChannelResponse,
    AddReactionResponse,
    BlockCommunityUserResponse,
    ChangeChannelRoleResponse,
    ChangeCommunityRoleResponse,
    ChannelMessageMatch,
    CommonResponses,
    CommunityInviteCodeResponse,
    CommunityPermissionRole,
    CommunityPermissions,
    CommunityRulesResponse,
    CreateChannelResponse,
    DeclineChannelInvitationResponse,
    DeleteChannelMessageResponse,
    DeleteChannelMessagesResponse,
    DeleteChannelResponse,
    DisableCommunityInviteCodeResponse,
    EditChannelMessageResponse,
    EnableCommunityInviteCodeResponse,
    EventsResponse,
    GateCheckFailedReason,
    GroupChatSummary,
    JoinChannelResponse,
    LeaveChannelResponse,
    MakeChannelPrivateResponse,
    MakeCommunityPrivateResponse,
    MemberRole,
    Message,
    PinChannelMessageResponse,
    RemoveChannelMemberResponse,
    RemoveChannelReactionResponse,
    RemoveCommunityMemberResponse,
    SearchChannelResponse,
    SelectedChannelInitialResponse,
    SelectedChannelUpdates,
    SelectedChannelUpdatesResponse,
    SendChannelMessageResponse,
    ToggleMuteChannelNotificationsResponse,
    ToggleMuteCommunityNotificationsResponse,
    UnblockCommunityUserResponse,
    UndeleteChannelMessagesResponse,
    UnsupportedValueError,
    UpdateChannelResponse,
    UpdateCommunityResponse,
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
    ApiMessageMatch,
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
import { ensureReplicaIsUpToDate } from "../common/replicaUpToDateChecker";
import type { Principal } from "@dfinity/principal";
import { groupRules, member, messageWrapper } from "../group/mappers";
import { ReplicaNotUpToDateError } from "../error";
import { keccak224 } from "js-sha3";

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

export function leaveChannelResponse(candid: ApiLeaveChannelResponse): LeaveChannelResponse {
    if ("UserNotInChannel" in candid) {
        return CommonResponses.userNotInChannel;
    }
    if ("LastOwnerCannotLeave" in candid) {
        return { kind: "last_owner_cannot_leave" };
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
    throw new UnsupportedValueError("Unexpected ApiLeaveChannelResponse type received", candid);
}

export function localUserIndexResponse(candid: ApiLocalUserIndexResponse): string {
    return candid.Success.toString();
}

export function makeChannelPrivateResponse(
    candid: ApiMakeChannelPrivateResponse
): MakeChannelPrivateResponse {
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
    if ("AlreadyPrivate" in candid) {
        return { kind: "channel_already_private" };
    }
    if ("CommunityFrozen" in candid) {
        return CommonResponses.communityFrozen;
    }
    throw new UnsupportedValueError(
        "Unexpected ApiMakeChannelPrivateResponse type received",
        candid
    );
}

export function makeCommunityPrivateResponse(
    candid: ApiMakePrivateResponse
): MakeCommunityPrivateResponse {
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
    if ("AlreadyPrivate" in candid) {
        return { kind: "community_already_private" };
    }
    if ("CommunityFrozen" in candid) {
        return CommonResponses.communityFrozen;
    }
    if ("InternalError" in candid) {
        return CommonResponses.internalError;
    }
    throw new UnsupportedValueError("Unexpected ApiMakePrivateResponse type received", candid);
}

export async function messagesByMessageIndexResponse(
    principal: Principal,
    candid: ApiMessagesByMessageIndexResponse,
    chatId: string,
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
        "ThreadMessageNotFound" in candid ||
        "ThreadNotFound" in candid ||
        "ChannelNotFound" in candid ||
        "UserNotInChannel" in candid ||
        "UserNotInCommunity" in candid
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

export function pinMessageResponse(candid: ApiPinMessageResponse): PinChannelMessageResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            event: {
                timestamp: candid.Success.timestamp,
                index: candid.Success.index,
                expiresAt: optional(candid.Success.expires_at, identity),
            },
        };
    } else {
        console.warn("PinChannelMessage failed with", candid);
        return CommonResponses.failure;
    }
}

export function removeMemberResponse(
    candid: ApiRemoveMemberResponse
): RemoveCommunityMemberResponse {
    if ("Success" in candid) {
        return CommonResponses.success;
    } else {
        console.warn("RemoveCommunityMember failed with", candid);
        return CommonResponses.failure;
    }
}

export function removeMemberFromChannelResponse(
    candid: ApiRemoveMemberFromChannelResponse
): RemoveChannelMemberResponse {
    if ("Success" in candid) {
        return CommonResponses.success;
    } else {
        console.warn("RemoveChannelMember failed with", candid);
        return CommonResponses.failure;
    }
}

export function removeReactionResponse(
    candid: ApiRemoveReactionResponse
): RemoveChannelReactionResponse {
    if ("Success" in candid) {
        return CommonResponses.success;
    } else {
        console.warn("RemoveChannelReaction failed with", candid);
        return CommonResponses.failure;
    }
}

export function rulesResponse(candid: ApiRulesResponse): CommunityRulesResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            rules: optional(candid.Success.rules, identity),
        };
    } else {
        console.warn("CommunityRules failed with", candid);
        return CommonResponses.failure;
    }
}

export function searchChannelResponse(candid: ApiSearchChannelResponse): SearchChannelResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            matches: candid.Success.matches.map(messageMatch),
        };
    } else {
        console.warn("SearchChannel failed with", candid);
        return CommonResponses.failure;
    }
}

export function messageMatch(candid: ApiMessageMatch): ChannelMessageMatch {
    const sender = candid.sender.toString();
    return {
        content: messageContent(candid.content, sender),
        sender,
        score: candid.score,
        messageIndex: candid.message_index,
    };
}

export function selectedChannelInitialResponse(
    candid: ApiSelectedChannelInitialResponse
): SelectedChannelInitialResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            members: candid.Success.members.map(member),
            invitedUsers: new Set(candid.Success.invited_users.map((u) => u.toString())),
            blockedUsers: new Set(candid.Success.blocked_users.map((u) => u.toString())),
            timestamp: candid.Success.timestamp,
            pinnedMessages: new Set(candid.Success.pinned_messages),
            latestEventIndex: candid.Success.latest_event_index,
            rules: groupRules(candid.Success.rules),
        };
    } else {
        console.warn("SelectedChannelInitial failed with", candid);
        return CommonResponses.failure;
    }
}

export function selectedChannelUpdatesResponse(
    candid: ApiSelectedChannelUpdatesResponse
): SelectedChannelUpdatesResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            membersAddedOrUpdated: candid.Success.members_added_or_updated.map(member),
            membersRemoved: new Set(candid.Success.members_removed.map((u) => u.toString())),
            blockedUsersAdded: new Set(candid.Success.blocked_users_added.map((u) => u.toString())),
            blockedUsersRemoved: new Set(
                candid.Success.blocked_users_removed.map((u) => u.toString())
            ),
            pinnedMessagesAdded: new Set(candid.Success.pinned_messages_added),
            pinnedMessagesRemoved: new Set(candid.Success.pinned_messages_removed),
            latestEventIndex: candid.Success.latest_event_index,
            rules: optional(candid.Success.rules, groupRules),
            invitedUsers: optional(
                candid.Success.invited_users,
                (invited_users) => new Set(invited_users.map((u) => u.toString()))
            ),
            timestamp: candid.Success.timestamp,
        };
    } else if ("SuccessNoUpdates" in candid) {
        return CommonResponses.successNoUpdates;
    } else {
        console.warn("SelectedChannelUpdates failed with", candid);
        return CommonResponses.failure;
    }
}

export function sendMessageResponse(candid: ApiSendMessageResponse): SendChannelMessageResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            timestamp: candid.Success.timestamp,
            eventIndex: candid.Success.event_index,
            expiresAt: optional(candid.Success.expires_at, identity),
            messageIndex: candid.Success.message_index,
        };
    } else {
        console.warn("SendChannelMessage failed with", candid);
        return CommonResponses.failure;
    }
}

export function summaryResponse(_candid: ApiSummaryResponse): unknown {
    return {};
}

export function summaryUpdatesResponse(_candid: ApiSummaryUpdatesResponse): unknown {
    return {};
}

export function toggleMuteChannelNotificationsResponse(
    candid: ApiToggleMuteChannelNotificationsResponse
): ToggleMuteChannelNotificationsResponse {
    if ("Success" in candid) {
        return CommonResponses.success;
    } else {
        console.warn("ToggleMuteChannelNotifications failed with", candid);
        return CommonResponses.failure;
    }
}

export function toggleMuteNotificationsResponse(
    candid: ApiToggleMuteNotificationsResponse
): ToggleMuteCommunityNotificationsResponse {
    if ("Success" in candid) {
        return CommonResponses.success;
    } else {
        console.warn("ToggleMuteCommunityNotifications failed with", candid);
        return CommonResponses.failure;
    }
}

export function unblockUserResponse(candid: ApiUnblockUserResponse): UnblockCommunityUserResponse {
    if ("Success" in candid) {
        return CommonResponses.success;
    } else {
        console.warn("UnblockCommunityUser failed with", candid);
        return CommonResponses.failure;
    }
}

export function undeleteMessagesResponse(
    candid: ApiUndeleteMessagesResponse
): UndeleteChannelMessagesResponse {
    if ("Success" in candid) {
        return { kind: "success", messages: candid.Success.messages.map(message) };
    } else {
        console.warn("UndeleteChannelMessages failed with", candid);
        return CommonResponses.failure;
    }
}

export function updateChannelResponse(candid: ApiUpdateChannelResponse): UpdateChannelResponse {
    if ("Success" in candid) {
        return CommonResponses.success;
    } else {
        console.warn("UpdateChannel failed with", candid);
        return CommonResponses.failure;
    }
}

export function updateCommunityResponse(
    candid: ApiUpdateCommunityResponse
): UpdateCommunityResponse {
    if ("Success" in candid) {
        return CommonResponses.success;
    } else {
        console.warn("UpdateCommunity failed with", candid);
        return CommonResponses.failure;
    }
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
