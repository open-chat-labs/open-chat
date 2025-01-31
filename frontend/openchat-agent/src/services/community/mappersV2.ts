import type {
    AddMembersToChannelResponse,
    BlockCommunityUserResponse,
    ChangeCommunityRoleResponse,
    ChannelMatch,
    ChannelSummaryResponse,
    CommunityCanisterChannelSummaryUpdates,
    CommunityCanisterCommunitySummaryUpdates,
    CommunityDetailsResponse,
    CommunityDetailsUpdatesResponse,
    CommunityMembershipUpdates,
    CommunityPermissions,
    CommunitySummaryResponse,
    CommunitySummaryUpdatesResponse,
    CreateUserGroupResponse,
    DeleteUserGroupsResponse,
    ExploreChannelsResponse,
    FollowThreadResponse,
    GroupMembershipUpdates,
    ImportGroupResponse,
    MemberRole,
    PublicApiKeyDetails,
    RemoveMemberResponse,
    SendMessageResponse,
    SetMemberDisplayNameResponse,
    UnblockCommunityUserResponse,
    UpdateCommunityResponse,
    UpdateUserGroupResponse,
    UserFailedError,
    UserGroupDetails,
} from "openchat-shared";
import { toBigInt32, CommonResponses, UnsupportedValueError } from "openchat-shared";
import type {
    ChannelMatch as TChannelMatch,
    CommunityCanisterCommunitySummaryUpdates as TCommunityCanisterCommunitySummaryUpdates,
    CommunityCanisterChannelSummaryUpdates as TCommunityCanisterChannelSummaryUpdates,
    CommunityMembershipUpdates as TCommunityMembershipUpdates,
    CommunitySendMessageResponse,
    CommunityAddMembersToChannelResponse,
    CommunityAddMembersToChannelFailedResult,
    CommunityAddMembersToChannelUserFailedError,
    CommunityAddMembersToChannelPartialSuccessResult,
    CommunityBlockUserResponse,
    CommunityRole as TCommunityRole,
    CommunityChangeRoleResponse,
    CommunityRemoveMemberResponse,
    CommunityRemoveMemberFromChannelResponse,
    CommunitySelectedInitialResponse,
    GroupMembershipUpdates as TGroupMembershipUpdates,
    GroupRole as TGroupRole,
    UserGroupDetails as TUserGroupDetails,
    CommunitySelectedUpdatesResponse,
    CommunityChannelSummaryResponse,
    CommunityImportGroupResponse,
    CommunitySummaryResponse as TCommunitySummaryResponse,
    CommunitySummaryUpdatesResponse as TCommunitySummaryUpdatesResponse,
    CommunityExploreChannelsResponse,
    CommunityUnblockUserResponse,
    CommunityUpdateCommunityResponse,
    OptionalCommunityPermissions as TOptionalCommunityPermissions,
    CommunityCreateUserGroupResponse,
    CommunityReportMessageResponse,
    CommunityFollowThreadResponse,
    CommunityUnfollowThreadResponse,
    CommunitySetMemberDisplayNameResponse,
    CommunityDeleteUserGroupsResponse,
    CommunityUpdateUserGroupResponse,
} from "../../typebox";
import { mapOptional, optionUpdateV2, principalBytesToString } from "../../utils/mapping";
import {
    accessGateConfig,
    apiCommunityPermissionRole,
    botGroupDetails,
    chatMetrics,
    communityChannelSummary,
    communityPermissions,
    communitySummary,
    groupPermissions,
    groupSubtype,
    memberRole,
    mentions,
    messageEvent,
    publicApiKeyDetails,
    threadSyncDetails,
    updatedEvent,
    userGroup,
} from "../common/chatMappersV2";
import { identity } from "../../utils/mapping";
import { mapCommonResponses } from "../common/commonResponseMapper";

export function addMembersToChannelResponse(
    value: CommunityAddMembersToChannelResponse,
): AddMembersToChannelResponse {
    if (typeof value === "object") {
        if ("PartialSuccess" in value) {
            return addToChannelPartialSuccess(value.PartialSuccess);
        }
        if ("Failed" in value) {
            return addToChannelFailed(value.Failed);
        }
        if ("UserLimitReached" in value) {
            return CommonResponses.userLimitReached();
        }
    }
    return {
        kind: mapCommonResponses(value, "AddMembersToChannel"),
    };
}

function addToChannelFailed(
    value: CommunityAddMembersToChannelFailedResult,
): AddMembersToChannelResponse {
    return {
        kind: "add_to_channel_failed",
        usersLimitReached: value.users_limit_reached.map(principalBytesToString),
        usersAlreadyInChannel: value.users_already_in_channel.map(principalBytesToString),
        usersFailedWithError: value.users_failed_with_error.map(userFailedWithError),
    };
}

function userFailedWithError(value: CommunityAddMembersToChannelUserFailedError): UserFailedError {
    return {
        userId: principalBytesToString(value.user_id),
        error: value.error,
    };
}

function addToChannelPartialSuccess(
    value: CommunityAddMembersToChannelPartialSuccessResult,
): AddMembersToChannelResponse {
    return {
        kind: "add_to_channel_partial_success",
        usersLimitReached: value.users_limit_reached.map(principalBytesToString),
        usersAlreadyInChannel: value.users_already_in_channel.map(principalBytesToString),
        usersFailedWithError: value.users_failed_with_error.map(userFailedWithError),
        usersAdded: value.users_added.map(principalBytesToString),
    };
}

export function blockUserResponse(value: CommunityBlockUserResponse): BlockCommunityUserResponse {
    if (value === "Success") {
        return CommonResponses.success();
    } else {
        console.warn("BlockCommunityUser failed with ", value);
        return CommonResponses.failure();
    }
}

export function changeRoleResponse(
    value: CommunityChangeRoleResponse,
): ChangeCommunityRoleResponse {
    if (value === "Success") {
        return "success";
    } else {
        console.warn("Unexpected ApiChangeRoleResponse type received", value);
        return "failure";
    }
}

export function removeMemberResponse(value: CommunityRemoveMemberResponse): RemoveMemberResponse {
    if (value === "Success") {
        return "success";
    } else {
        console.warn("RemoveCommunityMember failed with", value);
        return "failure";
    }
}

export function removeMemberFromChannelResponse(
    value: CommunityRemoveMemberFromChannelResponse,
): RemoveMemberResponse {
    if (value === "Success") {
        return "success";
    } else {
        console.warn("RemoveChannelMember failed with", value);
        return "failure";
    }
}

export function sendMessageResponse(value: CommunitySendMessageResponse): SendMessageResponse {
    if (typeof value === "object") {
        if ("Success" in value) {
            return {
                kind: "success",
                timestamp: value.Success.timestamp,
                messageIndex: value.Success.message_index,
                eventIndex: value.Success.event_index,
                expiresAt: mapOptional(value.Success.expires_at, Number),
            };
        }
    }
    if (value === "RulesNotAccepted") {
        return { kind: "rules_not_accepted" };
    } else if (value === "CommunityRulesNotAccepted") {
        return { kind: "community_rules_not_accepted" };
    } else {
        console.warn("SendMessage failed with", value);
        return CommonResponses.failure();
    }
}

export function exploreChannelsResponse(
    value: CommunityExploreChannelsResponse,
    communityId: string,
): ExploreChannelsResponse {
    if (typeof value === "object" && "Success" in value) {
        return {
            kind: "success",
            matches: value.Success.matches.map((m) => channelMatch(m, communityId)),
            total: value.Success.total,
        };
    } else {
        console.warn("ExploreChannels failed with", value);
        return CommonResponses.failure();
    }
}

export function channelMatch(value: TChannelMatch, communityId: string): ChannelMatch {
    return {
        id: { kind: "channel", communityId, channelId: Number(toBigInt32(value.id)) },
        gateConfig: mapOptional(value.gate_config, accessGateConfig) ?? {
            expiry: undefined,
            gate: { kind: "no_gate" },
        },
        name: value.name,
        description: value.description,
        memberCount: value.member_count,
        avatar: {
            blobReference: mapOptional(value.avatar_id, (blobId) => ({
                blobId,
                canisterId: communityId,
            })),
        },
    };
}

export function communityChannelSummaryResponse(
    value: CommunityChannelSummaryResponse,
    communityId: string,
): ChannelSummaryResponse {
    if (typeof value === "object" && "Success" in value) {
        return communityChannelSummary(value.Success, communityId);
    } else {
        console.warn("CommunityChannelSummary failed with", value);
        return CommonResponses.failure();
    }
}

export function importGroupResponse(
    communityId: string,
    value: CommunityImportGroupResponse,
): ImportGroupResponse {
    if (typeof value === "object" && "Success" in value) {
        return {
            kind: "success",
            channelId: {
                kind: "channel",
                communityId,
                channelId: Number(toBigInt32(value.Success.channel_id)),
            },
        };
    } else {
        console.warn("ImportGroup failed with", value);
        return CommonResponses.failure();
    }
}

export function summaryResponse(value: TCommunitySummaryResponse): CommunitySummaryResponse {
    if (typeof value === "object" && "Success" in value) {
        return communitySummary(value.Success);
    } else {
        console.warn("CommunitySummary failed with", value);
        return CommonResponses.failure();
    }
}

export function summaryUpdatesResponse(
    value: TCommunitySummaryUpdatesResponse,
): CommunitySummaryUpdatesResponse {
    if (typeof value === "object" && "Success" in value) {
        return communitySummaryUpdates(value.Success);
    }
    if (value === "SuccessNoUpdates") {
        return CommonResponses.successNoUpdates();
    }
    if (value === "PrivateCommunity") {
        return CommonResponses.failure();
    }
    throw new UnsupportedValueError("invalid ApiSummaryUpdatesResponse received", value);
}

export function communitySummaryUpdates(
    value: TCommunityCanisterCommunitySummaryUpdates,
): CommunityCanisterCommunitySummaryUpdates {
    const communityId = principalBytesToString(value.community_id);
    return {
        id: { kind: "community", communityId },
        public: value.is_public,
        permissions: mapOptional(value.permissions, communityPermissions),
        channelsUpdated: value.channels_updated.map((c) => communityChannelUpdates(c, communityId)),
        metrics: mapOptional(value.metrics, chatMetrics),
        gateConfig: optionUpdateV2(value.gate_config, accessGateConfig),
        name: value.name,
        description: value.description,
        lastUpdated: value.last_updated,
        channelsRemoved: value.channels_removed.map((c) => ({
            kind: "channel",
            communityId,
            channelId: Number(toBigInt32(c)),
        })),
        avatarId: optionUpdateV2(value.avatar_id, identity),
        channelsAdded: value.channels_added.map((c) => communityChannelSummary(c, communityId)),
        membership: mapOptional(value.membership, communityMembershipUpdates),
        frozen: optionUpdateV2(value.frozen, (_) => true),
        latestEventIndex: value.latest_event_index,
        bannerId: optionUpdateV2(value.banner_id, identity),
        memberCount: value.member_count,
        primaryLanguage: value.primary_language,
        userGroups: value.user_groups.map(userGroup).map(([_, g]) => g),
        userGroupsDeleted: new Set(value.user_groups_deleted),
        verified: mapOptional(value.verified, identity),
    };
}

export function communityMembershipUpdates(
    value: TCommunityMembershipUpdates,
): CommunityMembershipUpdates {
    return {
        role: mapOptional(value.role, memberRole),
        displayName: optionUpdateV2(value.display_name, identity),
        rulesAccepted: value.rules_accepted,
        lapsed: value.lapsed,
    };
}

export function communityChannelUpdates(
    value: TCommunityCanisterChannelSummaryUpdates,
    communityId: string,
): CommunityCanisterChannelSummaryUpdates {
    return {
        id: { kind: "channel", communityId, channelId: Number(toBigInt32(value.channel_id)) },
        public: value.is_public,
        permissions: mapOptional(value.permissions_v2, groupPermissions),
        metrics: mapOptional(value.metrics, chatMetrics),
        subtype: optionUpdateV2(value.subtype, groupSubtype),
        dateLastPinned: value.date_last_pinned,
        gateConfig: optionUpdateV2(value.gate_config, accessGateConfig),
        name: value.name,
        description: value.description,
        externalUrl: optionUpdateV2(value.external_url, identity),
        lastUpdated: value.last_updated,
        avatarId: optionUpdateV2(value.avatar_id, identity),
        membership: mapOptional(value.membership, groupMembershipUpdates),
        updatedEvents: value.updated_events.map(updatedEvent),
        latestEventIndex: value.latest_event_index,
        latestMessageIndex: value.latest_message_index,
        memberCount: value.member_count,
        latestMessage: mapOptional(value.latest_message, messageEvent),
        eventsTTL: optionUpdateV2(value.events_ttl, identity),
        eventsTtlLastUpdated: value.events_ttl_last_updated,
        videoCallInProgress: optionUpdateV2(value.video_call_in_progress, (v) => v.message_index),
        messageVisibleToNonMembers: value.messages_visible_to_non_members,
    };
}

export function groupMembershipUpdates(value: TGroupMembershipUpdates): GroupMembershipUpdates {
    return {
        myRole: mapOptional(value.role, memberRole),
        notificationsMuted: value.notifications_muted,
        latestThreads: value.latest_threads.map(threadSyncDetails),
        unfollowedThreads: Array.from(value.unfollowed_threads),
        mentions: mentions(value.mentions),
        myMetrics: mapOptional(value.my_metrics, chatMetrics),
        rulesAccepted: value.rules_accepted,
        lapsed: value.lapsed,
    };
}

export function unblockUserResponse(
    value: CommunityUnblockUserResponse,
): UnblockCommunityUserResponse {
    if (value === "Success") {
        return CommonResponses.success();
    } else {
        console.warn("UnblockCommunityUser failed with", value);
        return CommonResponses.failure();
    }
}

export function updateCommunityResponse(
    value: CommunityUpdateCommunityResponse,
): UpdateCommunityResponse {
    if (typeof value === "object" && "SuccessV2" in value) {
        return {
            kind: "success",
            rulesVersion: value.SuccessV2.rules_version,
        };
    } else {
        console.warn("UpdateCommunity failed with", value);
        return CommonResponses.failure();
    }
}

export function apiMemberRole(domain: MemberRole): TGroupRole {
    switch (domain) {
        case "owner":
            return "Owner";
        case "admin":
            return "Admin";
        case "moderator":
            return "Moderator";
        default:
            return "Participant";
    }
}

export function apiCommunityRole(newRole: MemberRole): TCommunityRole {
    switch (newRole) {
        case "owner":
            return "Owner";
        case "admin":
            return "Admin";
        default:
            return "Member";
    }
}

export function apiOptionalCommunityPermissions(
    permissions: Partial<CommunityPermissions>,
): TOptionalCommunityPermissions {
    return {
        create_public_channel: mapOptional(
            permissions.createPublicChannel,
            apiCommunityPermissionRole,
        ),
        update_details: mapOptional(permissions.updateDetails, apiCommunityPermissionRole),
        remove_members: mapOptional(permissions.removeMembers, apiCommunityPermissionRole),
        invite_users: mapOptional(permissions.inviteUsers, apiCommunityPermissionRole),
        change_roles: mapOptional(permissions.changeRoles, apiCommunityPermissionRole),
        create_private_channel: mapOptional(
            permissions.createPrivateChannel,
            apiCommunityPermissionRole,
        ),
        manage_user_groups: mapOptional(permissions.manageUserGroups, apiCommunityPermissionRole),
    };
}

export function communityDetailsResponse(
    value: CommunitySelectedInitialResponse,
): CommunityDetailsResponse {
    if (typeof value === "object" && "Success" in value) {
        console.log("Community details: ", value.Success);
        return {
            members: value.Success.members
                .map((m) => ({
                    role: memberRole(m.role),
                    userId: principalBytesToString(m.user_id),
                    displayName: m.display_name,
                    lapsed: m.lapsed,
                }))
                .concat(
                    value.Success.basic_members.map((id) => ({
                        role: "member",
                        userId: principalBytesToString(id),
                        displayName: undefined,
                        lapsed: false,
                    })),
                ),
            blockedUsers: new Set(value.Success.blocked_users.map(principalBytesToString)),
            invitedUsers: new Set(value.Success.invited_users.map(principalBytesToString)),
            rules: value.Success.chat_rules,
            lastUpdated: value.Success.timestamp,
            userGroups: new Map(value.Success.user_groups.map(userGroupDetails)),
            referrals: new Set(value.Success.referrals.map(principalBytesToString)),
            bots: value.Success.bots.map(botGroupDetails),
            apiKeys: value.Success.api_keys.map(publicApiKeyDetails).reduce((m, k) => {
                m.set(k.botId, k);
                return m;
            }, new Map<string, PublicApiKeyDetails>()),
        };
    } else {
        console.warn("CommunityDetails failed with", value);
        return "failure";
    }
}

export function userGroupDetails(value: TUserGroupDetails): [number, UserGroupDetails] {
    return [
        value.user_group_id,
        {
            id: value.user_group_id,
            kind: "user_group",
            members: new Set<string>(value.members.map(principalBytesToString)),
            name: value.name,
        },
    ];
}

export function communityDetailsUpdatesResponse(
    value: CommunitySelectedUpdatesResponse,
): CommunityDetailsUpdatesResponse {
    if (typeof value === "object") {
        if ("Success" in value) {
            return {
                kind: "success",
                membersAddedOrUpdated: value.Success.members_added_or_updated.map((m) => ({
                    role: memberRole(m.role),
                    userId: principalBytesToString(m.user_id),
                    displayName: m.display_name,
                    lapsed: m.lapsed,
                })),
                membersRemoved: new Set(value.Success.members_removed.map(principalBytesToString)),
                blockedUsersAdded: new Set(
                    value.Success.blocked_users_added.map(principalBytesToString),
                ),
                blockedUsersRemoved: new Set(
                    value.Success.blocked_users_removed.map(principalBytesToString),
                ),
                rules: value.Success.chat_rules,
                invitedUsers: mapOptional(
                    value.Success.invited_users,
                    (invited_users) => new Set(invited_users.map(principalBytesToString)),
                ),
                lastUpdated: value.Success.timestamp,
                userGroups: value.Success.user_groups.map(userGroupDetails).map(([_, g]) => g),
                userGroupsDeleted: new Set(value.Success.user_groups_deleted),
                referralsRemoved: new Set(
                    value.Success.referrals_removed.map(principalBytesToString),
                ),
                referralsAdded: new Set(value.Success.referrals_added.map(principalBytesToString)),
                botsAddedOrUpdated: value.Success.bots_added_or_updated.map(botGroupDetails),
                botsRemoved: new Set(value.Success.bots_removed.map(principalBytesToString)),
                apiKeysGenerated: value.Success.api_keys_generated.map(publicApiKeyDetails),
            };
        } else if ("SuccessNoUpdates" in value) {
            return {
                kind: "success_no_updates",
                lastUpdated: value.SuccessNoUpdates,
            };
        }
    }
    console.warn("Unexpected ApiSelectedUpdatesResponse type received", value);
    return CommonResponses.failure();
}

export function createUserGroupResponse(
    value: CommunityCreateUserGroupResponse,
): CreateUserGroupResponse {
    if (typeof value === "object" && "Success" in value) {
        return {
            kind: "success",
            userGroupId: value.Success.user_group_id,
        };
    }
    if (value === "NameTaken") {
        return {
            kind: "name_taken",
        };
    } else {
        console.warn("CreateUserGroup failed with", value);
        return CommonResponses.failure();
    }
}

export function updateUserGroupResponse(
    value: CommunityUpdateUserGroupResponse,
): UpdateUserGroupResponse {
    if (value === "Success") {
        return CommonResponses.success();
    } else if (value === "NameTaken") {
        return {
            kind: "name_taken",
        };
    } else {
        console.warn("UpdateUserGroup failed with", value);
        return CommonResponses.failure();
    }
}

export function deleteUserGroupsResponse(
    value: CommunityDeleteUserGroupsResponse,
): DeleteUserGroupsResponse {
    if (value === "Success") {
        return CommonResponses.success();
    } else {
        console.warn("DeleteUserGroups failed with", value);
        return CommonResponses.failure();
    }
}

export function setMemberDisplayNameResponse(
    value: CommunitySetMemberDisplayNameResponse,
): SetMemberDisplayNameResponse {
    if (typeof value === "object") {
        if ("DisplayNameTooShort" in value) {
            return "display_name_too_short";
        }
        if ("DisplayNameTooLong" in value) {
            return "display_name_too_long";
        }
    }
    if (value === "DisplayNameInvalid") {
        return "display_name_invalid";
    }
    return mapCommonResponses(value, "SetMemberDisplayName");
}

export function followThreadResponse(
    value: CommunityFollowThreadResponse | CommunityUnfollowThreadResponse,
): FollowThreadResponse {
    if (value === "Success") {
        return "success";
    }
    if (value === "AlreadyFollowing" || value === "NotFollowing") {
        return "unchanged";
    } else {
        console.warn("followThread failed with", value);
        return "failed";
    }
}

export function reportMessageResponse(value: CommunityReportMessageResponse): boolean {
    return value === "Success" || value === "AlreadyReported";
}
