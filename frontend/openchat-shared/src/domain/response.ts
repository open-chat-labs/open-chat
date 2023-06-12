export type UserNotInChannel = { kind: "user_not_in_channel" };
export type ChannelNotFound = { kind: "channel_not_found" };
export type UserLimitReached = { kind: "user_limit_reached" };
export type Success = { kind: "success" };
export type SuccessNoUpdates = { kind: "success_no_updates" };
export type UserNotInCommunity = { kind: "user_not_in_community" };
export type CommunityFrozen = { kind: "community_frozen" };
export type CommunityNotPublic = { kind: "community_not_public" };
export type MessageNotFound = {
    kind: "message_not_found";
};
export type Failure = {
    kind: "failure";
};
export type NotAuthorised = {
    kind: "not_authorized";
};
export type UserSuspended = { kind: "user_suspended" };
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
export type UserBlocked = {
    kind: "user_blocked";
};
export type NotPlatformModerator = {
    kind: "not_platform_moderator";
};

export const CommonResponses = {
    userNotInChannel: { kind: "user_not_in_channel" } as UserNotInChannel,
    channelNotFound: { kind: "channel_not_found" } as ChannelNotFound,
    userLimitReached: { kind: "user_limit_reached" } as UserLimitReached,
    notAuthorized: { kind: "not_authorized" } as NotAuthorised,
    success: { kind: "success" } as Success,
    successNoUpdates: { kind: "success_no_updates" } as SuccessNoUpdates,
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
    userBlocked: { kind: "user_blocked" } as UserBlocked,
    failure: { kind: "failure" } as Failure,
};
