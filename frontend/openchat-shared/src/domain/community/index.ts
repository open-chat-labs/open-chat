import type { AccessControlled, AccessRules } from "../access";
import type { GateCheckFailedReason, Member, MessageContent } from "../chat";
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
export type CommunityNotPublic = { kind: "community_not_public" };
export type MessageNotFound = {
    kind: "message_not_found";
};
export type NoChange = {
    kind: "no_change";
};
export type InteralError = {
    kind: "internal_error";
};
export type Invalid = {
    kind: "invalid";
};

export type TargetUserNotInCommunity = {
    kind: "target_user_not_in_community";
};

export type NotPlatformModerator = {
    kind: "not_platform_moderator";
};

export type AddReactionResponse =
    | UserNotInChannel
    | ChannelNotFound
    | MessageNotFound
    | NoChange
    | NotAuthorised
    | Success
    | UserNotInCommunity
    | UserSuspended
    | CommunityFrozen
    | InvalidReaction;

export type InvalidReaction = { kind: "invalid_reaction" };

export type BlockCommunityUserResponse =
    | NotAuthorised
    | Success
    | UserNotInCommunity
    | CommunityNotPublic
    | UserSuspended
    | CommunityFrozen
    | TargetUserNotInCommunity
    | InteralError
    | { kind: "cannot_block_self" }
    | { kind: "cannot_block_user" };

export type ChangeChannelRoleResponse =
    | Invalid
    | UserNotInChannel
    | ChannelNotFound
    | NotAuthorised
    | Success
    | UserNotInCommunity
    | UserSuspended
    | CommunityFrozen
    | { kind: "target_user_not_in_channel" };

export type ChangeCommunityRoleResponse =
    | Invalid
    | NotAuthorised
    | Success
    | UserNotInCommunity
    | UserSuspended
    | CommunityFrozen
    | TargetUserNotInCommunity
    | InteralError;

export type CreateChannelResponse =
    | { kind: "max_channels_created" }
    | { kind: "name_reserved" }
    | { kind: "rules_too_long" }
    | { kind: "description_too_long" }
    | { kind: "name_too_short" }
    | NotAuthorised
    | { kind: "avatar_too_big" }
    | { kind: "success"; channelId: string }
    | UserSuspended
    | { kind: "rules_too_short" }
    | CommunityFrozen
    | { kind: "name_too_long" }
    | { kind: "name_taken" };

export type DeclineChannelInvitationResponse =
    | { kind: "not_invited" }
    | ChannelNotFound
    | Success
    | UserNotInCommunity;

export type DeleteChannelResponse =
    | UserNotInChannel
    | ChannelNotFound
    | NotAuthorised
    | Success
    | UserNotInCommunity
    | UserSuspended
    | CommunityFrozen;

export type DeleteChannelMessagesResponse =
    | UserNotInChannel
    | MessageNotFound
    | ChannelNotFound
    | Success
    | UserNotInCommunity
    | UserSuspended
    | CommunityFrozen
    | NotPlatformModerator
    | InteralError;

export type DeleteChannelMessageResponse =
    | UserNotInChannel
    | MessageNotFound
    | ChannelNotFound
    | NotAuthorised
    | (Success & { content: MessageContent })
    | UserNotInCommunity
    | { kind: "message_hard_deleted" }
    | { kind: "message_not_deleted" };

export type DisableCommunityInviteCodeResponse =
    | NotAuthorised
    | Success
    | UserSuspended
    | CommunityFrozen;

export type EditChannelMessageResponse =
    | UserNotInChannel
    | MessageNotFound
    | ChannelNotFound
    | Success
    | UserNotInCommunity
    | UserSuspended
    | CommunityFrozen;

export type EnableCommunityInviteCodeResponse =
    | NotAuthorised
    | (Success & { code: bigint })
    | UserSuspended
    | CommunityFrozen;

export type CommunityInviteCodeResponse =
    | NotAuthorised
    | (Success & { code?: bigint })
    | UserNotInCommunity;

export const CommonResponses = {
    userNotInChannel: { kind: "user_not_in_channel" } as UserNotInChannel,
    channelNotFound: { kind: "channel_not_found" } as ChannelNotFound,
    userLimitReached: { kind: "user_limit_reached" } as UserLimitReached,
    notAuthorized: { kind: "not_authorized" } as NotAuthorised,
    success: { kind: "success" } as Success,
    userNotInCommunity: { kind: "user_not_in_community" } as UserNotInCommunity,
    userSuspended: { kind: "user_suspended" } as UserSuspended,
    communityFrozen: { kind: "community_frozen" } as CommunityFrozen,
    messageNotFound: { kind: "message_not_found" } as MessageNotFound,
    noChange: { kind: "no_change" } as NoChange,
    communityNotPublic: { kind: "community_not_public" } as CommunityNotPublic,
    internalError: { kind: "internal_error" } as InteralError,
    invalid: { kind: "invalid" } as Invalid,
    targetUserNotInCommunity: { kind: "target_user_not_in_community" } as TargetUserNotInCommunity,
    notPlatformModerator: { kind: "not_platform_moderator" } as NotPlatformModerator,
};
