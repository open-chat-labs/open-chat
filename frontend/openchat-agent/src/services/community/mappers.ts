import {
    AddMembersToChannelResponse,
    BlockCommunityUserResponse,
    ChangeCommunityRoleResponse,
    ChannelIdentifier,
    ChannelMatch,
    ChannelMembershipUpdates,
    ChannelMessageMatch,
    ChannelSummaryResponse,
    CommonResponses,
    CommunityCanisterChannelSummaryUpdates,
    CommunityCanisterCommunitySummaryUpdates,
    CommunityDetailsResponse,
    CommunityDetailsUpdatesResponse,
    CommunityInviteCodeResponse,
    CommunityMembershipUpdates,
    CommunityPermissions,
    CommunitySummaryResponse,
    CommunitySummaryUpdatesResponse,
    DisableCommunityInviteCodeResponse,
    EnableCommunityInviteCodeResponse,
    EventsResponse,
    ExploreChannelsResponse,
    GateCheckFailedReason,
    ImportGroupResponse,
    JoinGroupResponse,
    ManageDefaultChannelsResponse,
    MemberRole,
    Message,
    RemoveMemberResponse,
    SearchChannelResponse,
    SendMessageResponse,
    ToggleMuteCommunityNotificationsResponse,
    UnblockCommunityUserResponse,
    UnsupportedValueError,
    UpdateCommunityResponse,
    UpdatedEvent,
    UserFailedError,
    UserFailedGateCheck,
} from "openchat-shared";
import type {
    ApiAddMembersToChannelResponse,
    ApiBlockUserResponse,
    ApiChangeRoleResponse,
    ApiDisableInviteCodeResponse,
    ApiInviteCodeResponse,
    ApiJoinChannelResponse,
    ApiLocalUserIndexResponse,
    ApiMessagesByMessageIndexResponse,
    ApiRemoveMemberResponse,
    ApiRemoveMemberFromChannelResponse,
    ApiSearchChannelResponse,
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
    ApiUserFailedGateCheck,
    ApiUserFailedError,
    ApiMessageMatch,
    ApiEnableInviteCodeResponse,
    ApiCommunityCanisterCommunitySummaryUpdates,
    ApiCommunityCanisterChannelSummaryUpdates,
    ApiChannelMembershipUpdates,
    ApiCommunityMembershipUpdates,
    ApiExploreChannelsResponse,
    ApiChannelMatch,
    ApiSelectedInitialResponse,
    ApiSelectedUpdatesResponse,
    ApiChannelSummaryResponse,
    ApiImportGroupResponse,
    ApiManageDefaultChannelsResponse,
} from "./candid/idl";
import {
    accessGate,
    apiCommunityPermissionRole,
    apiOptional,
    chatMetrics,
    communityChannelSummary,
    communityPermissions,
    communitySummary,
    gateCheckFailedReason,
    groupPermissions,
    groupRules,
    groupSubtype,
    memberRole,
    mention,
    messageContent,
    messageEvent,
    threadDetails,
} from "../common/chatMappers";
import type { ApiGateCheckFailedReason } from "../localUserIndex/candid/idl";
import { identity, optionUpdate, optional } from "../../utils/mapping";
import { ensureReplicaIsUpToDate } from "../common/replicaUpToDateChecker";
import type { Principal } from "@dfinity/principal";
import { messageWrapper } from "../group/mappers";
import { ReplicaNotUpToDateError } from "../error";

export function manageDefaultChannelsResponse(
    candid: ApiManageDefaultChannelsResponse
): ManageDefaultChannelsResponse {
    if ("Success" in candid) {
        return CommonResponses.success();
    } else {
        console.warn("ManageDefaultChannels failed with ", candid);
        return CommonResponses.failure();
    }
}

export function addMembersToChannelResponse(
    candid: ApiAddMembersToChannelResponse
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
    if ("CommunityFrozen" in candid) {
        return CommonResponses.communityFrozen();
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

export function disableInviteCodeResponse(
    candid: ApiDisableInviteCodeResponse
): DisableCommunityInviteCodeResponse {
    if ("NotAuthorized" in candid) {
        return CommonResponses.notAuthorized();
    }
    if ("Success" in candid) {
        return CommonResponses.success();
    }
    if ("UserSuspended" in candid) {
        return CommonResponses.userSuspended();
    }
    if ("CommunityFrozen" in candid) {
        return CommonResponses.communityFrozen();
    }
    throw new UnsupportedValueError(
        "Unexpected ApiDisableInviteCodeResponse type received",
        candid
    );
}

export function enableInviteCodeResponse(
    candid: ApiEnableInviteCodeResponse
): EnableCommunityInviteCodeResponse {
    if ("NotAuthorized" in candid) {
        return CommonResponses.notAuthorized();
    }
    if ("Success" in candid) {
        return { kind: "success", code: candid.Success.code };
    }
    if ("UserSuspended" in candid) {
        return CommonResponses.userSuspended();
    }
    if ("CommunityFrozen" in candid) {
        return CommonResponses.communityFrozen();
    }
    throw new UnsupportedValueError("Unexpected ApiEnableInviteCodeResponse type received", candid);
}

export function inviteCodeResponse(candid: ApiInviteCodeResponse): CommunityInviteCodeResponse {
    if ("NotAuthorized" in candid) {
        return CommonResponses.notAuthorized();
    }
    if ("Success" in candid) {
        return { kind: "success", code: optional(candid.Success.code, identity) };
    }
    if ("UserNotInCommunity" in candid) {
        return CommonResponses.userNotInCommunity();
    }
    throw new UnsupportedValueError("Unexpected ApiEnableInviteCodeResponse type received", candid);
}

export function joinChannelResponse(
    candid: ApiJoinChannelResponse,
    communityId: string
): JoinGroupResponse {
    if ("Success" in candid) {
        return { kind: "success", group: communityChannelSummary(candid.Success, communityId) };
    } else if ("AlreadyInChannel" in candid) {
        return {
            kind: "success",
            group: communityChannelSummary(candid.AlreadyInChannel, communityId),
        };
    } else if ("UserBlocked" in candid) {
        return CommonResponses.userBlocked();
    } else if ("GateCheckFailed" in candid) {
        return { kind: "gate_check_failed", reason: gateCheckFailedReason(candid.GateCheckFailed) };
    } else {
        console.warn("Join group failed with: ", candid);
        return CommonResponses.failure();
    }
}

export function localUserIndexResponse(candid: ApiLocalUserIndexResponse): string {
    return candid.Success.toString();
}

export async function messagesByMessageIndexResponse(
    principal: Principal,
    candid: ApiMessagesByMessageIndexResponse,
    chatId: ChannelIdentifier,
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

export function removeMemberResponse(candid: ApiRemoveMemberResponse): RemoveMemberResponse {
    if ("Success" in candid) {
        return "success";
    } else {
        console.warn("RemoveCommunityMember failed with", candid);
        return "failure";
    }
}

export function removeMemberFromChannelResponse(
    candid: ApiRemoveMemberFromChannelResponse
): RemoveMemberResponse {
    if ("Success" in candid) {
        return "success";
    } else {
        console.warn("RemoveChannelMember failed with", candid);
        return "failure";
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
        return CommonResponses.failure();
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
        };
    }
    if ("CallerNotInGroup" in candid) {
        return { kind: "not_in_group" };
    }
    if ("TextTooLong" in candid) {
        return { kind: "text_too_long" };
    }
    if ("MessageEmpty" in candid) {
        return { kind: "message_empty" };
    }
    if ("InvalidRequest" in candid) {
        return { kind: "invalid_request", reason: candid.InvalidRequest };
    }
    if ("InvalidPoll" in candid) {
        return { kind: "invalid_poll" };
    }
    if ("NotAuthorized" in candid) {
        return { kind: "not_authorized" };
    }
    if ("ThreadMessageNotFound" in candid) {
        return { kind: "thread_message_not_found" };
    }
    if ("UserSuspended" in candid) {
        return { kind: "user_suspended" };
    }
    if ("ChatFrozen" in candid) {
        return { kind: "chat_frozen" };
    }

    return CommonResponses.failure();
}

export function exploreChannelsResponse(
    candid: ApiExploreChannelsResponse,
    communityId: string
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
        isDefault: candid.is_default,
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
    communityId: string
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
    candid: ApiImportGroupResponse
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
    candid: ApiSummaryUpdatesResponse
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
    throw new UnsupportedValueError("invalid ApiSummaryUpdatesResponse recieved", candid);
}

export function communitySummaryUpdates(
    candid: ApiCommunityCanisterCommunitySummaryUpdates
): CommunityCanisterCommunitySummaryUpdates {
    const communityId = candid.community_id.toString();
    return {
        id: { kind: "community", communityId },
        public: optional(candid.is_public, identity),
        permissions: optional(candid.permissions, communityPermissions),
        channelsUpdated: candid.channels_updated.map((c) =>
            communityChannelUpdates(c, communityId)
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
        bannerId: optionUpdate(candid.avatar_id, identity),
        memberCount: optional(candid.member_count, identity),
        primaryLanguage: optional(candid.primary_language, identity),
    };
}

export function communityMembershipUpdates(
    candid: ApiCommunityMembershipUpdates
): CommunityMembershipUpdates {
    return {
        role: optional(candid.role, memberRole),
    };
}

export function communityChannelUpdates(
    candid: ApiCommunityCanisterChannelSummaryUpdates,
    communityId: string
): CommunityCanisterChannelSummaryUpdates {
    return {
        id: { kind: "channel", communityId, channelId: candid.channel_id.toString() },
        public: optional(candid.is_public, identity),
        permissions: optional(candid.permissions, groupPermissions),
        metrics: optional(candid.metrics, chatMetrics),
        subtype: optionUpdate(candid.subtype, groupSubtype),
        dateLastPinned: optional(candid.date_last_pinned, identity),
        gate: optionUpdate(candid.gate, accessGate),
        name: optional(candid.name, identity),
        description: optional(candid.description, identity),
        lastUpdated: candid.last_updated,
        avatarId: optionUpdate(candid.avatar_id, identity),
        membership: optional(candid.membership, channelMembershipUpdates),
        updatedEvents: candid.updated_events.map(updatedEvent),
        latestEventIndex: optional(candid.latest_event_index, identity),
        memberCount: optional(candid.member_count, identity),
        latestMessage: optional(candid.latest_message, messageEvent),
        isDefault: optional(candid.is_default, identity),
    };
}

function updatedEvent([threadRootMessageIndex, eventIndex, timestamp]: [
    [] | [number],
    number,
    bigint
]): UpdatedEvent {
    return {
        eventIndex,
        threadRootMessageIndex: optional(threadRootMessageIndex, identity),
        timestamp,
    };
}

export function channelMembershipUpdates(
    candid: ApiChannelMembershipUpdates
): ChannelMembershipUpdates {
    return {
        role: optional(candid.role, memberRole),
        notificationsMuted: optional(candid.notifications_muted, identity),
        latestThreads: candid.latest_threads.map(threadDetails),
        mentions: candid.mentions
            .filter((m) => m.thread_root_message_index.length === 0)
            .map(mention),
        myMetrics: optional(candid.my_metrics, chatMetrics),
    };
}

export function toggleMuteNotificationsResponse(
    candid: ApiToggleMuteNotificationsResponse
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
    candid: ApiUpdateCommunityResponse
): UpdateCommunityResponse {
    if ("Success" in candid) {
        return CommonResponses.success();
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
    permissions: Partial<CommunityPermissions>
): ApiOptionalCommunityPermissions {
    return {
        create_public_channel: apiOptional(
            apiCommunityPermissionRole,
            permissions.createPublicChannel
        ),
        block_users: apiOptional(apiCommunityPermissionRole, permissions.blockUsers),
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

export function communityDetailsResponse(
    candid: ApiSelectedInitialResponse
): CommunityDetailsResponse {
    if ("Success" in candid) {
        return {
            members: candid.Success.members.map((m) => ({
                role: memberRole(m.role),
                userId: m.user_id.toString(),
            })),
            blockedUsers: new Set(candid.Success.blocked_users.map((u) => u.toString())),
            invitedUsers: new Set(candid.Success.invited_users.map((u) => u.toString())),
            rules: groupRules(candid.Success.rules),
            lastUpdated: candid.Success.timestamp,
        };
    } else {
        console.warn("CommunityDetails failed with", candid);
        return "failure";
    }
}

export function communityDetailsUpdatesResponse(
    candid: ApiSelectedUpdatesResponse
): CommunityDetailsUpdatesResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            membersAddedOrUpdated: candid.Success.members_added_or_updated.map((m) => ({
                role: memberRole(m.role),
                userId: m.user_id.toString(),
            })),
            membersRemoved: new Set(candid.Success.members_removed.map((u) => u.toString())),
            blockedUsersAdded: new Set(candid.Success.blocked_users_added.map((u) => u.toString())),
            blockedUsersRemoved: new Set(
                candid.Success.blocked_users_removed.map((u) => u.toString())
            ),
            rules: optional(candid.Success.rules, groupRules),
            invitedUsers: optional(
                candid.Success.invited_users,
                (invited_users) => new Set(invited_users.map((u) => u.toString()))
            ),
            lastUpdated: candid.Success.timestamp,
        };
    } else if ("SuccessNoUpdates" in candid) {
        return {
            kind: "success_no_updates",
            lastUpdated: candid.SuccessNoUpdates || BigInt(Date.now()),
        };
    } else {
        console.warn("Unexpected ApiSelectedUpdatesResponse type received", candid);
        return CommonResponses.failure();
    }
}
