// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { LocalUserIndexInviteUsersToChannelFailedResult } from "./LocalUserIndexInviteUsersToChannelFailedResult";
import type { LocalUserIndexInviteUsersToChannelPartialSuccessResult } from "./LocalUserIndexInviteUsersToChannelPartialSuccessResult";

export type LocalUserIndexInviteUsersToChannelResponse = "Success" | { "PartialSuccess": LocalUserIndexInviteUsersToChannelPartialSuccessResult } | { "Failed": LocalUserIndexInviteUsersToChannelFailedResult } | "CommunityFrozen" | "UserNotInCommunity" | "ChannelNotFound" | "UserNotInChannel" | "UserSuspended" | "UserLapsed" | "NotAuthorized" | { "TooManyInvites": number } | { "InternalError": string };
