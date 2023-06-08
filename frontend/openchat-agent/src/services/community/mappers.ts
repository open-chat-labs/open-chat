import type { CommunityPermissionRole, CommunityPermissions, MemberRole } from "openchat-shared";
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
} from "./candid/idl";
import { apiOptional } from "../common/chatMappers";

export function addMembersToChannelResponse(_candid: ApiAddMembersToChannelResponse): unknown {
    return {};
}

export function addReactionResponse(_candid: ApiAddReactionResponse): unknown {
    return {};
}

export function blockUserResponse(_candid: ApiBlockUserResponse): unknown {
    return {};
}

export function changeChannelRoleResponse(_candid: ApiChangeChannelRoleResponse): unknown {
    return {};
}

export function changeRoleResponse(_candid: ApiChangeRoleResponse): unknown {
    return {};
}

export function createChannelResponse(_candid: ApiCreateChannelResponse): unknown {
    return {};
}

export function declineInvitationResponse(_candid: ApiDeclineInvitationResponse): unknown {
    return {};
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
