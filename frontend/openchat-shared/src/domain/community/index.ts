import type { AccessControlled, AccessRules } from "../access";
import type { GateCheckFailedReason, Member } from "../chat";
import type { DataContent } from "../data";
import type { HasIdentity } from "../identity";
import type { CommunityPermissionRole, Permissioned } from "../permission";
import type { HasLevel } from "../structure";

export type Community = HasIdentity &
    AccessControlled &
    HasLevel &
    Permissioned<CommunityPermissions> & {
        name: string;
        description: string;
        memberCount: number;
        channelCount: number;
        unreadCount: number;
        avatar: DataContent;
        banner: DataContent;
    };

export type CommunityPermissions = {
    changePermissions: CommunityPermissionRole;
    changeRoles: CommunityPermissionRole;
    inviteUsers: CommunityPermissionRole;
    removeMembers: CommunityPermissionRole;
    blockUsers: CommunityPermissionRole;
    updateDetails: CommunityPermissionRole;
    createPublicChannel: CommunityPermissionRole;
    createPrivateChannel: CommunityPermissionRole;
};

// TODO - not sure if this really needs to be a thing yet
export type DefaultChannel = {
    name: string;
    createdAt: number;
};

export type CommunitySpecificState = {
    members: Member[];
    blockedUsers: Set<string>;
    invitedUsers: Set<string>;
    rules?: AccessRules;
};

export interface UserFailedGateCheck {
    userId: string;
    reason: GateCheckFailedReason;
}

export interface UserFailedError {
    userId: string;
    error: string;
}

export type AddMembersToChannelFailed = {
    kind: "add_to_channel_failed";
    usersLimitReached: string[];
    usersFailedGateCheck: UserFailedGateCheck[];
    usersAlreadyInChannel: string[];
    usersFailedWithError: UserFailedError[];
};
export interface AddMembersToChannelPartialSuccess {
    kind: "add_to_channel_partial_success";
    usersLimitReached: string[];
    usersFailedGateCheck: UserFailedGateCheck[];
    usersAlreadyInChannel: string[];
    usersFailedWithError: UserFailedError[];
    usersAdded: string[];
}
export type AddMembersToChannelResponse =
    | AddMembersToChannelFailed
    | AddMembersToChannelPartialSuccess
    | UserNotInChannel
    | ChannelNotFound
    | UserLimitReached
    | NotAuthorised
    | Success
    | UserNotInCommunity
    | UserSuspended
    | CommunityFrozen;

export type UserNotInChannel = { kind: "user_not_in_channel" };
export type ChannelNotFound = { kind: "channel_not_found" };
export type UserLimitReached = { kind: "user_limit_reached" };
export type NotAuthorised = { kind: "not_authorized" };
export type Success = { kind: "success" };
export type UserNotInCommunity = { kind: "user_not_in_community" };
export type UserSuspended = { kind: "user_suspended" };
export type CommunityFrozen = { kind: "community_frozen" };

export const CommonResponses = {
    userNotInChannel: { kind: "user_not_in_channel" } as UserNotInChannel,
    channelNotFound: { kind: "channel_not_found" } as ChannelNotFound,
    userLimitReached: { kind: "user_limit_reached" } as UserLimitReached,
    notAuthorized: { kind: "not_authorized" } as NotAuthorised,
    success: { kind: "success" } as Success,
    userNotInCommunity: { kind: "user_not_in_community" } as UserNotInCommunity,
    userSuspended: { kind: "user_suspended" } as UserSuspended,
    communityFrozen: { kind: "community_frozen" } as CommunityFrozen,
};
