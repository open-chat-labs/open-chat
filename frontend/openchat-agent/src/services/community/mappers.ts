import type {
    AddMembersToChannelResponse,
    BlockCommunityUserResponse,
    ChangeCommunityRoleResponse,
    ChannelIdentifier,
    ChannelMatch,
    ChannelMessageMatch,
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
    EventsResponse,
    ExploreChannelsResponse,
    FollowThreadResponse,
    GroupMembershipUpdates,
    ImportGroupResponse,
    MemberRole,
    Message,
    RemoveMemberResponse,
    SendMessageResponse,
    SetMemberDisplayNameResponse,
    ToggleMuteCommunityNotificationsResponse,
    UnblockCommunityUserResponse,
    UpdateCommunityResponse,
    UpdatedEvent,
    UpdateUserGroupResponse,
    UserFailedError,
    UserGroupDetails,
} from "openchat-shared";
import { CommonResponses, UnsupportedValueError } from "openchat-shared";
import type {
    ApiAddMembersToChannelResponse,
    ApiBlockUserResponse,
    ApiChangeRoleResponse,
    ApiMessagesByMessageIndexResponse,
    ApiRemoveMemberResponse,
    ApiRemoveMemberFromChannelResponse,
    ApiSendMessageResponse,
    ApiSummaryResponse,
    ApiSummaryUpdatesResponse,
    ApiToggleMuteNotificationsResponse,
    ApiUnblockUserResponse,
    ApiUpdateCommunityResponse,
    ApiGroupRole,
    ApiCommunityRole,
    ApiOptionalCommunityPermissions,
    ApiAddMembersToChannelFailed,
    ApiAddMembersToChannelPartialSuccess,
    ApiUserFailedError,
    ApiMessageMatch,
    ApiCommunityCanisterCommunitySummaryUpdates,
    ApiCommunityCanisterChannelSummaryUpdates,
    ApiGroupMembershipUpdates,
    ApiCommunityMembershipUpdates,
    ApiExploreChannelsResponse,
    ApiChannelMatch,
    ApiSelectedInitialResponse,
    ApiSelectedUpdatesResponse,
    ApiChannelSummaryResponse,
    ApiImportGroupResponse,
    ApiCreateUserGroupResponse,
    ApiUpdateUserGroupResponse,
    ApiUserGroupDetails,
    ApiDeleteUserGroupsResponse,
    ApiSetMemberDisplayNameResponse,
    ApiFollowThreadResponse,
    ApiUnfollowThreadResponse,
} from "./candid/idl";
import {
    accessGate,
    apiCommunityPermissionRole,
    apiOptional,
    chatMetrics,
    communityChannelSummary,
    communityPermissions,
    communitySummary,
    groupPermissions,
    groupSubtype,
    memberRole,
    mention,
    messageContent,
    messageEvent,
    messagesSuccessResponse,
    threadDetails,
    userGroup,
} from "../common/chatMappers";
import { identity, optionUpdate, optional } from "../../utils/mapping";
import { ensureReplicaIsUpToDate } from "../common/replicaUpToDateChecker";
import type { Principal } from "@dfinity/principal";
import { ReplicaNotUpToDateError } from "../error";
import type { ReportMessageResponse } from "./candid/types";

export function addMembersToChannelResponse(
    candid: ApiAddMembersToChannelResponse,
): AddMembersToChannelResponse {
    if ("Failed" in candid) {
        return addToChannelFailed(candid.Failed);
    }
    if ("UserNotInChannel" in candid) {
        return CommonResponses.userNotInChat();
    }
    if ("PartialSuccess" in candid) {
        return addToChannelPartialSuccess(candid.PartialSuccess);
    }
    if ("ChannelNotFound" in candid) {
        return CommonResponses.chatNotFound();
    }
    if ("UserLimitReached" in candid) {
        return CommonResponses.userLimitReached();
    }
    if ("NotAuthorized" in candid) {
        return CommonResponses.notAuthorized();
    }
    if ("Success" in candid) {
        return CommonResponses.success();
    }
    if ("UserNotInCommunity" in candid) {
        return CommonResponses.userNotInCommunity();
    }
    if ("UserSuspended" in candid) {
        return CommonResponses.userSuspended();
    }
    if ("UserLapsed" in candid) {
        return CommonResponses.userLapsed();
    }
    if ("CommunityFrozen" in candid) {
        return CommonResponses.communityFrozen();
    }
    if ("CommunityPublic" in candid) {
        return CommonResponses.communityPublic();
    }
    if ("InternalError" in candid) {
        return CommonResponses.internalError();
    }
    if ("CommunityPublic" in candid) {
        return CommonResponses.communityPublic();
    }
    throw new UnsupportedValueError(
        "Unexpected ApiAddMembersToChannelResponse type received",
        candid,
    );
}

function addToChannelFailed(candid: ApiAddMembersToChannelFailed): AddMembersToChannelResponse {
    return {
        kind: "add_to_channel_failed",
        usersLimitReached: candid.users_limit_reached.map((u) => u.toString()),
        usersAlreadyInChannel: candid.users_already_in_channel.map((u) => u.toString()),
        usersFailedWithError: candid.users_failed_with_error.map(userFailedWithError),
    };
}

function userFailedWithError(candid: ApiUserFailedError): UserFailedError {
    return {
        userId: candid.user_id.toString(),
        error: candid.error,
    };
}

function addToChannelPartialSuccess(
    candid: ApiAddMembersToChannelPartialSuccess,
): AddMembersToChannelResponse {
    return {
        kind: "add_to_channel_partial_success",
        usersLimitReached: candid.users_limit_reached.map((u) => u.toString()),
        usersAlreadyInChannel: candid.users_already_in_channel.map((u) => u.toString()),
        usersFailedWithError: candid.users_failed_with_error.map(userFailedWithError),
        usersAdded: candid.users_added.map((u) => u.toString()),
    };
}

export function blockUserResponse(candid: ApiBlockUserResponse): BlockCommunityUserResponse {
    if ("Success" in candid) {
        return CommonResponses.success();
    } else {
        console.warn("BlockCommunityUser failed with ", candid);
        return CommonResponses.failure();
    }
}

export function changeRoleResponse(candid: ApiChangeRoleResponse): ChangeCommunityRoleResponse {
    if ("Success" in candid) {
        return "success";
    } else {
        console.warn("Unexpected ApiChangeRoleResponse type received", candid);
        return "failure";
    }
}

export async function messagesByMessageIndexResponse(
    principal: Principal,
    candid: ApiMessagesByMessageIndexResponse,
    chatId: ChannelIdentifier,
    latestKnownUpdatePreRequest: bigint | undefined,
): Promise<EventsResponse<Message>> {
    if ("Success" in candid) {
        await ensureReplicaIsUpToDate(principal, chatId, candid.Success.chat_last_updated);

        return messagesSuccessResponse(candid.Success);
    }
    if (
        "CallerNotInGroup" in candid ||
        "ThreadMessageNotFound" in candid ||
        "ThreadNotFound" in candid ||
        "ChannelNotFound" in candid ||
        "UserSuspended" in candid ||
        "UserLapsed" in candid ||
        "UserNotInChannel" in candid ||
        "UserNotInCommunity" in candid
    ) {
        return "events_failed";
    }
    if ("ReplicaNotUpToDateV2" in candid) {
        throw ReplicaNotUpToDateError.byTimestamp(
            candid.ReplicaNotUpToDateV2,
            latestKnownUpdatePreRequest ?? BigInt(-1),
            false,
        );
    }
    throw new UnsupportedValueError(
        "Unexpected ApiMessagesByMessageIndexResponse type received",
        candid,
    );
}

export function removeMemberResponse(candid: ApiRemoveMemberResponse): RemoveMemberResponse {
    if ("Success" in candid) {
        return "success";
    } else {
        console.warn("RemoveCommunityMember failed with", candid);
        return "failure";
    }
}

export function removeMemberFromChannelResponse(
    candid: ApiRemoveMemberFromChannelResponse,
): RemoveMemberResponse {
    if ("Success" in candid) {
        return "success";
    } else {
        console.warn("RemoveChannelMember failed with", candid);
        return "failure";
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

export function sendMessageResponse(candid: ApiSendMessageResponse): SendMessageResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            timestamp: candid.Success.timestamp,
            messageIndex: candid.Success.message_index,
            eventIndex: candid.Success.event_index,
            expiresAt: optional(candid.Success.expires_at, Number),
        };
    } else if ("RulesNotAccepted" in candid) {
        return { kind: "rules_not_accepted" };
    } else if ("CommunityRulesNotAccepted" in candid) {
        return { kind: "community_rules_not_accepted" };
    } else {
        console.warn("SendMessage failed with", candid);
        return CommonResponses.failure();
    }
}

export function exploreChannelsResponse(
    candid: ApiExploreChannelsResponse,
    communityId: string,
): ExploreChannelsResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            matches: candid.Success.matches.map((m) => channelMatch(m, communityId)),
            total: candid.Success.total,
        };
    } else {
        console.warn("ExploreChannels failed with", candid);
        return CommonResponses.failure();
    }
}

export function channelMatch(candid: ApiChannelMatch, communityId: string): ChannelMatch {
    return {
        id: { kind: "channel", communityId, channelId: candid.id.toString() },
        gate: optional(candid.gate, accessGate) ?? { kind: "no_gate" },
        name: candid.name,
        description: candid.description,
        memberCount: candid.member_count,
        avatar: {
            blobReference: optional(candid.avatar_id, (blobId) => ({
                blobId,
                canisterId: communityId,
            })),
        },
    };
}

export function communityChannelSummaryResponse(
    candid: ApiChannelSummaryResponse,
    communityId: string,
): ChannelSummaryResponse {
    if ("Success" in candid) {
        return communityChannelSummary(candid.Success, communityId);
    } else {
        console.warn("CommunityChannelSummary failed with", candid);
        return CommonResponses.failure();
    }
}

export function importGroupResponse(
    communityId: string,
    candid: ApiImportGroupResponse,
): ImportGroupResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            channelId: {
                kind: "channel",
                communityId,
                channelId: candid.Success.channel_id.toString(),
            },
        };
    } else {
        console.warn("ImportGroup failed with", candid);
        return CommonResponses.failure();
    }
}

export function summaryResponse(candid: ApiSummaryResponse): CommunitySummaryResponse {
    if ("Success" in candid) {
        return communitySummary(candid.Success);
    } else {
        console.warn("CommunitySummary failed with", candid);
        return CommonResponses.failure();
    }
}

export function summaryUpdatesResponse(
    candid: ApiSummaryUpdatesResponse,
): CommunitySummaryUpdatesResponse {
    if ("Success" in candid) {
        return communitySummaryUpdates(candid.Success);
    }
    if ("SuccessNoUpdates" in candid) {
        return CommonResponses.successNoUpdates();
    }
    if ("PrivateCommunity" in candid) {
        return CommonResponses.failure();
    }
    throw new UnsupportedValueError("invalid ApiSummaryUpdatesResponse received", candid);
}

export function communitySummaryUpdates(
    candid: ApiCommunityCanisterCommunitySummaryUpdates,
): CommunityCanisterCommunitySummaryUpdates {
    const communityId = candid.community_id.toString();
    return {
        id: { kind: "community", communityId },
        public: optional(candid.is_public, identity),
        permissions: optional(candid.permissions, communityPermissions),
        channelsUpdated: candid.channels_updated.map((c) =>
            communityChannelUpdates(c, communityId),
        ),
        metrics: optional(candid.metrics, chatMetrics),
        gate: optionUpdate(candid.gate, accessGate),
        name: optional(candid.name, identity),
        description: optional(candid.description, identity),
        lastUpdated: candid.last_updated,
        channelsRemoved: candid.channels_removed.map((c) => ({
            kind: "channel",
            communityId,
            channelId: c.toString(),
        })),
        avatarId: optionUpdate(candid.avatar_id, identity),
        channelsAdded: candid.channels_added.map((c) => communityChannelSummary(c, communityId)),
        membership: optional(candid.membership, communityMembershipUpdates),
        frozen: optionUpdate(candid.frozen, (_) => true),
        latestEventIndex: optional(candid.latest_event_index, identity),
        bannerId: optionUpdate(candid.banner_id, identity),
        memberCount: optional(candid.member_count, identity),
        primaryLanguage: optional(candid.primary_language, identity),
        userGroups: candid.user_groups.map(userGroup).map(([_, g]) => g),
        userGroupsDeleted: new Set(candid.user_groups_deleted),
    };
}

export function communityMembershipUpdates(
    candid: ApiCommunityMembershipUpdates,
): CommunityMembershipUpdates {
    return {
        role: optional(candid.role, memberRole),
        displayName: optionUpdate(candid.display_name, identity),
        rulesAccepted: optional(candid.rules_accepted, identity),
    };
}

export function communityChannelUpdates(
    candid: ApiCommunityCanisterChannelSummaryUpdates,
    communityId: string,
): CommunityCanisterChannelSummaryUpdates {
    return {
        id: { kind: "channel", communityId, channelId: candid.channel_id.toString() },
        public: optional(candid.is_public, identity),
        permissions: optional(candid.permissions_v2, groupPermissions),
        metrics: optional(candid.metrics, chatMetrics),
        subtype: optionUpdate(candid.subtype, groupSubtype),
        dateLastPinned: optional(candid.date_last_pinned, identity),
        gate: optionUpdate(candid.gate, accessGate),
        name: optional(candid.name, identity),
        description: optional(candid.description, identity),
        externalUrl: optionUpdate(candid.external_url, identity),
        lastUpdated: candid.last_updated,
        avatarId: optionUpdate(candid.avatar_id, identity),
        membership: optional(candid.membership, GroupMembershipUpdates),
        updatedEvents: candid.updated_events.map(updatedEvent),
        latestEventIndex: optional(candid.latest_event_index, identity),
        latestMessageIndex: optional(candid.latest_message_index, identity),
        memberCount: optional(candid.member_count, identity),
        latestMessage: optional(candid.latest_message, messageEvent),
        eventsTTL: optionUpdate(candid.events_ttl, identity),
        eventsTtlLastUpdated: optional(candid.events_ttl_last_updated, identity),
        videoCallInProgress: optionUpdate(candid.video_call_in_progress, (v) => v.message_index),
        messageVisibleToNonMembers: optional(candid.messages_visible_to_non_members, identity),
    };
}

function updatedEvent([threadRootMessageIndex, eventIndex, timestamp]: [
    [] | [number],
    number,
    bigint,
]): UpdatedEvent {
    return {
        eventIndex,
        threadRootMessageIndex: optional(threadRootMessageIndex, identity),
        timestamp,
    };
}

export function GroupMembershipUpdates(candid: ApiGroupMembershipUpdates): GroupMembershipUpdates {
    return {
        role: optional(candid.role, memberRole),
        notificationsMuted: optional(candid.notifications_muted, identity),
        latestThreads: candid.latest_threads.map(threadDetails),
        unfollowedThreads: Array.from(candid.unfollowed_threads),
        mentions: candid.mentions
            .filter((m) => m.thread_root_message_index.length === 0)
            .map(mention),
        myMetrics: optional(candid.my_metrics, chatMetrics),
        rulesAccepted: optional(candid.rules_accepted, identity),
    };
}

export function toggleMuteNotificationsResponse(
    candid: ApiToggleMuteNotificationsResponse,
): ToggleMuteCommunityNotificationsResponse {
    if ("Success" in candid) {
        return CommonResponses.success();
    } else {
        console.warn("ToggleMuteCommunityNotifications failed with", candid);
        return CommonResponses.failure();
    }
}

export function unblockUserResponse(candid: ApiUnblockUserResponse): UnblockCommunityUserResponse {
    if ("Success" in candid) {
        return CommonResponses.success();
    } else {
        console.warn("UnblockCommunityUser failed with", candid);
        return CommonResponses.failure();
    }
}

export function updateCommunityResponse(
    candid: ApiUpdateCommunityResponse,
): UpdateCommunityResponse {
    if ("SuccessV2" in candid) {
        return {
            kind: "success",
            rulesVersion: optional(candid.SuccessV2.rules_version, identity),
        };
    } else {
        console.warn("UpdateCommunity failed with", candid);
        return CommonResponses.failure();
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

export function communityRole(candid: ApiCommunityRole): MemberRole {
    if ("Member" in candid) {
        return "member";
    }
    if ("Admin" in candid) {
        return "admin";
    }
    if ("Owner" in candid) {
        return "owner";
    }
    throw new UnsupportedValueError("Unknown community role", candid);
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
    permissions: Partial<CommunityPermissions>,
): ApiOptionalCommunityPermissions {
    return {
        create_public_channel: apiOptional(
            apiCommunityPermissionRole,
            permissions.createPublicChannel,
        ),
        update_details: apiOptional(apiCommunityPermissionRole, permissions.updateDetails),
        remove_members: apiOptional(apiCommunityPermissionRole, permissions.removeMembers),
        invite_users: apiOptional(apiCommunityPermissionRole, permissions.inviteUsers),
        change_roles: apiOptional(apiCommunityPermissionRole, permissions.changeRoles),
        create_private_channel: apiOptional(
            apiCommunityPermissionRole,
            permissions.createPrivateChannel,
        ),
        manage_user_groups: apiOptional(apiCommunityPermissionRole, permissions.manageUserGroups),
    };
}

export function communityDetailsResponse(
    candid: ApiSelectedInitialResponse,
): CommunityDetailsResponse {
    if ("Success" in candid) {
        return {
            members: candid.Success.members.map((m) => ({
                role: memberRole(m.role),
                userId: m.user_id.toString(),
                displayName: optional(m.display_name, identity),
            })),
            blockedUsers: new Set(candid.Success.blocked_users.map((u) => u.toString())),
            invitedUsers: new Set(candid.Success.invited_users.map((u) => u.toString())),
            rules: candid.Success.chat_rules,
            lastUpdated: candid.Success.timestamp,
            userGroups: new Map(candid.Success.user_groups.map(userGroupDetails)),
            referrals: new Set(candid.Success.referrals.map((u) => u.toString())),
        };
    } else {
        console.warn("CommunityDetails failed with", candid);
        return "failure";
    }
}

export function userGroupDetails(candid: ApiUserGroupDetails): [number, UserGroupDetails] {
    return [
        candid.user_group_id,
        {
            id: candid.user_group_id,
            kind: "user_group",
            members: new Set<string>(candid.members.map((m) => m.toString())),
            name: candid.name,
        },
    ];
}

export function communityDetailsUpdatesResponse(
    candid: ApiSelectedUpdatesResponse,
): CommunityDetailsUpdatesResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            membersAddedOrUpdated: candid.Success.members_added_or_updated.map((m) => ({
                role: memberRole(m.role),
                userId: m.user_id.toString(),
                displayName: optional(m.display_name, identity),
            })),
            membersRemoved: new Set(candid.Success.members_removed.map((u) => u.toString())),
            blockedUsersAdded: new Set(candid.Success.blocked_users_added.map((u) => u.toString())),
            blockedUsersRemoved: new Set(
                candid.Success.blocked_users_removed.map((u) => u.toString()),
            ),
            rules: optional(candid.Success.chat_rules, identity),
            invitedUsers: optional(
                candid.Success.invited_users,
                (invited_users) => new Set(invited_users.map((u) => u.toString())),
            ),
            lastUpdated: candid.Success.timestamp,
            userGroups: candid.Success.user_groups.map(userGroupDetails).map(([_, g]) => g),
            userGroupsDeleted: new Set(candid.Success.user_groups_deleted),
            referralsRemoved: new Set(candid.Success.referrals_removed.map((u) => u.toString())),
            referralsAdded: new Set(candid.Success.referrals_added.map((u) => u.toString())),
        };
    } else if ("SuccessNoUpdates" in candid) {
        return {
            kind: "success_no_updates",
            lastUpdated: candid.SuccessNoUpdates,
        };
    } else {
        console.warn("Unexpected ApiSelectedUpdatesResponse type received", candid);
        return CommonResponses.failure();
    }
}

export function createUserGroupResponse(
    candid: ApiCreateUserGroupResponse,
): CreateUserGroupResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            userGroupId: candid.Success.user_group_id,
        };
    } else if ("NameTaken" in candid) {
        return {
            kind: "name_taken",
        };
    } else {
        console.warn("CreateUserGroup failed with", candid);
        return CommonResponses.failure();
    }
}

export function updateUserGroupResponse(
    candid: ApiUpdateUserGroupResponse,
): UpdateUserGroupResponse {
    if ("Success" in candid) {
        return CommonResponses.success();
    } else if ("NameTaken" in candid) {
        return {
            kind: "name_taken",
        };
    } else {
        console.warn("UpdateUserGroup failed with", candid);
        return CommonResponses.failure();
    }
}

export function deleteUserGroupsResponse(
    candid: ApiDeleteUserGroupsResponse,
): DeleteUserGroupsResponse {
    if ("Success" in candid) {
        return CommonResponses.success();
    } else {
        console.warn("DeleteUserGroups failed with", candid);
        return CommonResponses.failure();
    }
}

export function setMemberDisplayNameResponse(
    candid: ApiSetMemberDisplayNameResponse,
): SetMemberDisplayNameResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("UserNotInCommunity" in candid) {
        return "user_not_in_community";
    }
    if ("UserSuspended" in candid) {
        return "user_suspended";
    }
    if ("UserLapsed" in candid) {
        return "user_lapsed";
    }
    if ("CommunityFrozen" in candid) {
        return "community_frozen";
    }
    if ("DisplayNameTooShort" in candid) {
        return "display_name_too_short";
    }
    if ("DisplayNameTooLong" in candid) {
        return "display_name_too_long";
    }
    if ("DisplayNameInvalid" in candid) {
        return "display_name_invalid";
    }
    throw new UnsupportedValueError(
        "Unexpected ApiSetMemberDisplayNameResponse type received",
        candid,
    );
}

export function followThreadResponse(
    candid: ApiFollowThreadResponse | ApiUnfollowThreadResponse,
): FollowThreadResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("AlreadyFollowing" in candid || "NotFollowing" in candid) {
        return "unchanged";
    } else {
        console.warn("followThread failed with", candid);
        return "failed";
    }
}

export function reportMessageResponse(candid: ReportMessageResponse): boolean {
    return "Success" in candid || "AlreadyReported" in candid;
}
