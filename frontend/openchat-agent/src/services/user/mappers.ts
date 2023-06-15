import type {
    ApiEventsResponse,
    ApiCreateGroupResponse,
    ApiDeleteGroupResponse,
    ApiDirectChatEventWrapper,
    ApiSendMessageResponse,
    ApiBlockUserResponse,
    ApiUnblockUserResponse,
    ApiLeaveGroupResponse,
    ApiMarkReadResponse,
    ApiSetAvatarResponse,
    ApiAddReactionResponse,
    ApiRemoveReactionResponse,
    ApiDirectChatEvent,
    ApiDeleteMessageResponse,
    ApiUndeleteMessageResponse,
    ApiSearchDirectChatResponse,
    ApiMessageMatch,
    ApiEditMessageResponse,
    ApiInitialStateResponse,
    ApiUpdatesResponse,
    ApiGroupRole,
    ApiMention,
    ApiSetBioResponse,
    ApiWithdrawCryptoResponse,
    ApiSendMessageWithTransferToGroupResponse,
    ApiPublicProfileResponse,
    ApiPinChatResponse,
    ApiUnpinChatResponse,
    ApiThreadSyncDetails,
    ApiMigrateUserPrincipalResponse,
    ApiDirectChatSummary,
    ApiGroupChatSummary,
    ApiUserCanisterGroupChatSummary,
    ApiUserCanisterGroupChatSummaryUpdates,
    ApiNnsFailedCryptoTransaction,
    ApiNnsCompletedCryptoTransaction,
    ApiSnsFailedCryptoTransaction,
    ApiSnsCompletedCryptoTransaction,
    ApiArchiveChatResponse,
    ApiIcrc1Account,
    ApiDirectChatSummaryUpdates,
    ApiDeletedDirectMessageResponse,
    ApiSetMessageReminderResponse,
    ApiCreateCommunityResponse,
    ApiGroupChatsInitial,
    ApiCachedGroupChatSummaries,
    ApiDirectChatsInitial,
    ApiCommunitiesInitial,
    ApiUserCanisterCommunitySummary,
    ApiUserCanisterChannelSummary,
    ApiFavouriteChatsInitial,
    ApiChat,
    ApiCommunitiesUpdates,
    ApiUserCanisterCommunitySummaryUpdates,
    ApiUserCanisterChannelSummaryUpdates,
} from "./candid/idl";
import {
    EventsResponse,
    EventWrapper,
    CreateGroupResponse,
    DeleteGroupResponse,
    DirectChatEvent,
    SendMessageResponse,
    BlockUserResponse,
    UnblockUserResponse,
    LeaveGroupResponse,
    MarkReadResponse,
    SetAvatarResponse,
    AddRemoveReactionResponse,
    DeleteMessageResponse,
    UndeleteMessageResponse,
    EditMessageResponse,
    InitialStateResponse,
    UpdatesResponse,
    MemberRole,
    Mention,
    GroupChatSummary,
    DirectChatSummary,
    UserCanisterGroupChatSummary,
    UserCanisterGroupChatSummaryUpdates,
    WithdrawCryptocurrencyResponse,
    FailedCryptocurrencyWithdrawal,
    CompletedCryptocurrencyWithdrawal,
    ThreadSyncDetails,
    PublicProfile,
    ArchiveChatResponse,
    MessageMatch,
    MigrateUserPrincipalResponse,
    PinChatResponse,
    SearchDirectChatResponse,
    SetBioResponse,
    UnpinChatResponse,
    UnsupportedValueError,
    DirectChatSummaryUpdates,
    DeletedDirectMessageResponse,
    UpdatedEvent,
    SetMessageReminderResponse,
    CommonResponses,
    CreateCommunityResponse,
    GroupChatsInitial,
    CachedGroupChatSummaries,
    DirectChatsInitial,
    CommunitiesInitial,
    UserCanisterCommunitySummary,
    UserCanisterChannelSummary,
    FavouriteChatsInitial,
    ChatIdentifier,
    CommunitiesUpdates,
    UserCanisterCommunitySummaryUpdates,
    UserCanisterChannelSummaryUpdates,
} from "openchat-shared";
import { bytesToHexString, identity, optional, optionUpdate } from "../../utils/mapping";
import {
    apiGroupSubtype,
    chatMetrics,
    completedCryptoTransfer,
    accessGate,
    groupPermissions,
    message,
    messageContent,
    token,
    updatedMessage,
} from "../common/chatMappers";
import { ensureReplicaIsUpToDate } from "../common/replicaUpToDateChecker";
import { ReplicaNotUpToDateError } from "../error";
import type { Principal } from "@dfinity/principal";

export function publicProfileResponse(candid: ApiPublicProfileResponse): PublicProfile {
    const profile = candid.Success;
    return {
        username: profile.username,
        avatarId: optional(profile.avatar_id, identity),
        bio: profile.bio,
        isPremium: profile.is_premium,
        phoneIsVerified: profile.phone_is_verified,
        created: profile.created,
    };
}

export function setBioResponse(candid: ApiSetBioResponse): SetBioResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("TooLong" in candid) {
        return "bio_too_long";
    }
    if ("UserSuspended" in candid) {
        return "user_suspended";
    }
    throw new UnsupportedValueError(`Unexpected ApiSetBioResponse type received`, candid);
}

export function searchDirectChatResponse(
    candid: ApiSearchDirectChatResponse,
    chatId: string
): SearchDirectChatResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            matches: candid.Success.matches.map((m) => messageMatch(m, chatId)),
        };
    }
    if ("TermTooShort" in candid || "TermTooLong" in candid || "InvalidTerm" in candid) {
        return {
            kind: "term_invalid",
        };
    }
    if ("ChatNotFound" in candid) {
        return {
            kind: "chat_not_found",
        };
    }
    throw new UnsupportedValueError(
        "Unknown UserIndex.ApiSearchMessagesResponse type received",
        candid
    );
}

export function messageMatch(candid: ApiMessageMatch, chatId: string): MessageMatch {
    const sender = candid.sender.toString();
    return {
        chatId,
        messageIndex: candid.message_index,
        content: messageContent(candid.content, sender),
        sender,
        score: candid.score,
    };
}

export function deleteMessageResponse(candid: ApiDeleteMessageResponse): DeleteMessageResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("ChatNotFound" in candid) {
        return "chat_not_found";
    }
    if ("UserSuspended" in candid) {
        return "user_suspended";
    }
    throw new UnsupportedValueError("Unexpected ApiDeleteMessageResponse type received", candid);
}

export function undeleteMessageResponse(
    candid: ApiUndeleteMessageResponse
): UndeleteMessageResponse {
    if ("Success" in candid) {
        if (candid.Success.messages.length == 0) {
            return { kind: "internal_error" };
        } else {
            return {
                kind: "success",
                message: message(candid.Success.messages[0]),
            };
        }
    }
    if ("ChatNotFound" in candid) {
        return { kind: "chat_not_found" };
    }
    if ("UserSuspended" in candid) {
        return { kind: "user_suspended" };
    }
    throw new UnsupportedValueError("Unexpected ApiUndeleteMessageResponse type received", candid);
}

export function addRemoveReactionResponse(
    candid: ApiAddReactionResponse | ApiRemoveReactionResponse
): AddRemoveReactionResponse {
    if ("Success" in candid || "SuccessV2" in candid) {
        return "success";
    }
    if ("NoChange" in candid) {
        return "no_change";
    }
    if ("InvalidReaction" in candid) {
        return "invalid";
    }
    if ("ChatNotFound" in candid) {
        return "chat_not_found";
    }
    if ("MessageNotFound" in candid) {
        return "message_not_found";
    }
    if ("NotAuthorized" in candid) {
        return "not_authorized";
    }
    if ("UserSuspended" in candid) {
        return "user_suspended";
    }
    throw new UnsupportedValueError(
        "Unexpected ApiAddRemoveReactionResponse type received",
        candid
    );
}

export function setAvatarResponse(candid: ApiSetAvatarResponse): SetAvatarResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("AvatarTooBig" in candid) {
        return "avatar_too_big";
    }
    if ("UserSuspended" in candid) {
        return "user_suspended";
    }
    if ("InternalError" in candid) {
        return "internal_error";
    }
    throw new UnsupportedValueError("Unexpected ApiSetAvatarResponse type received", candid);
}

export function markReadResponse(_candid: ApiMarkReadResponse): MarkReadResponse {
    // currently only one success type which makes mapping this a bit redundant but I'll
    // leave the pattern in place in case we have other return types in the future.
    return "success";
}

export function leaveGroupResponse(candid: ApiLeaveGroupResponse): LeaveGroupResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("CallerNotInGroup" in candid) {
        return "not_in_group";
    }
    if ("InternalError" in candid) {
        return "internal_error";
    }
    if ("GroupNotFound" in candid) {
        return "group_not_found";
    }
    if ("GroupNotPublic" in candid) {
        return "group_not_public";
    }
    if ("OwnerCannotLeave" in candid) {
        return "owner_cannot_leave";
    }
    if ("UserSuspended" in candid) {
        return "user_suspended";
    }
    if ("ChatFrozen" in candid) {
        return "chat_frozen";
    }
    throw new UnsupportedValueError("Unexpected ApiLeaveGroupResponse type received", candid);
}

export function blockResponse(_candid: ApiBlockUserResponse): BlockUserResponse {
    return "success";
}

export function unblockResponse(_candid: ApiUnblockUserResponse): UnblockUserResponse {
    return "success";
}

export function pinChatResponse(candid: ApiPinChatResponse): PinChatResponse {
    if ("Success" in candid) {
        return { kind: "success" };
    }

    if ("PinnedLimitReached" in candid) {
        return { kind: "pinned_limit_reached", limit: candid.PinnedLimitReached };
    }

    throw new UnsupportedValueError("Unexpected ApiPinChatResponse type received", candid);
}

export function unpinChatResponse(_candid: ApiUnpinChatResponse): UnpinChatResponse {
    return "success";
}

export function archiveChatResponse(candid: ApiArchiveChatResponse): ArchiveChatResponse {
    if ("Success" in candid) {
        return "success";
    }

    if ("ChatNotFound" in candid) {
        return "chat_not_found";
    }

    throw new UnsupportedValueError("Unexpected ApiArchiveChatResponse type received", candid);
}

export function editMessageResponse(candid: ApiEditMessageResponse): EditMessageResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("ChatNotFound" in candid) {
        return "chat_not_found";
    }
    if ("MessageNotFound" in candid) {
        return "message_not_found";
    }
    if ("UserBlocked" in candid) {
        return "user_blocked";
    }
    if ("UserSuspended" in candid) {
        return "user_suspended";
    }
    throw new UnsupportedValueError("Unexpected ApiEditMessageResponse type received", candid);
}

export function sendMessageWithTransferToGroupResponse(
    candid: ApiSendMessageWithTransferToGroupResponse,
    sender: string,
    recipient: string
): SendMessageResponse {
    if ("Success" in candid) {
        const transfer =
            "NNS" in candid.Success.transfer
                ? candid.Success.transfer.NNS
                : candid.Success.transfer.SNS;

        return {
            kind: "transfer_success",
            timestamp: candid.Success.timestamp,
            messageIndex: candid.Success.message_index,
            eventIndex: candid.Success.event_index,
            transfer: completedCryptoTransfer(transfer, sender, recipient),
        };
    }
    if ("TransferCannotBeZero" in candid) {
        return { kind: "transfer_cannot_be_zero" };
    }
    if ("RecipientBlocked" in candid) {
        return { kind: "recipient_blocked" };
    }
    if ("InvalidRequest" in candid) {
        return { kind: "invalid_request", reason: candid.InvalidRequest };
    }
    if ("TextTooLong" in candid) {
        return { kind: "text_too_long" };
    }
    if ("MessageEmpty" in candid) {
        return { kind: "message_empty" };
    }
    if ("RecipientNotFound" in candid) {
        return { kind: "recipient_not_found" };
    }
    if ("TransferFailed" in candid) {
        return { kind: "transfer_failed" };
    }
    if ("CallerNotInGroup" in candid) {
        return { kind: "caller_not_in_group" };
    }
    if ("CryptocurrencyNotSupported" in candid) {
        return { kind: "cryptocurrency_not_supported" };
    }
    if ("InternalError" in candid) {
        return { kind: "internal_error" };
    }
    if ("TransferLimitExceeded" in candid) {
        return { kind: "transfer_limit_exceeded" };
    }
    if ("InvalidPoll" in candid) {
        return { kind: "invalid_poll" };
    }
    if ("UserSuspended" in candid) {
        return { kind: "user_suspended" };
    }
    if ("ChatFrozen" in candid) {
        return { kind: "chat_frozen" };
    }
    throw new UnsupportedValueError("Unexpected ApiSendMessageResponse type received", candid);
}

export function sendMessageResponse(
    candid: ApiSendMessageResponse,
    sender: string,
    recipient: string
): SendMessageResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            timestamp: candid.Success.timestamp,
            messageIndex: candid.Success.message_index,
            eventIndex: candid.Success.event_index,
        };
    }
    if ("TransferSuccessV2" in candid) {
        const transfer =
            "NNS" in candid.TransferSuccessV2.transfer
                ? candid.TransferSuccessV2.transfer.NNS
                : candid.TransferSuccessV2.transfer.SNS;

        return {
            kind: "transfer_success",
            timestamp: candid.TransferSuccessV2.timestamp,
            messageIndex: candid.TransferSuccessV2.message_index,
            eventIndex: candid.TransferSuccessV2.event_index,
            transfer: completedCryptoTransfer(transfer, sender, recipient),
        };
    }
    if ("TransferCannotBeZero" in candid) {
        return { kind: "transfer_cannot_be_zero" };
    }
    if ("RecipientBlocked" in candid) {
        return { kind: "recipient_blocked" };
    }
    if ("InvalidRequest" in candid) {
        return { kind: "invalid_request", reason: candid.InvalidRequest };
    }
    if ("TextTooLong" in candid) {
        return { kind: "text_too_long" };
    }
    if ("MessageEmpty" in candid) {
        return { kind: "message_empty" };
    }
    if ("RecipientNotFound" in candid) {
        return { kind: "recipient_not_found" };
    }
    if ("TransferFailed" in candid) {
        return { kind: "transfer_failed" };
    }
    if ("TransferLimitExceeded" in candid) {
        return { kind: "transfer_limit_exceeded" };
    }
    if ("InvalidPoll" in candid) {
        return { kind: "invalid_poll" };
    }
    if ("UserSuspended" in candid) {
        return { kind: "user_suspended" };
    }
    if ("ChatFrozen" in candid) {
        return { kind: "chat_frozen" };
    }
    if ("InternalError" in candid) {
        return { kind: "internal_error" };
    }
    throw new UnsupportedValueError("Unexpected ApiSendMessageResponse type received", candid);
}

export function createCommunityResponse(
    candid: ApiCreateCommunityResponse
): CreateCommunityResponse {
    if ("Success" in candid) {
        return { kind: "success", id: candid.Success.community_id.toString() };
    } else if ("NameTaken" in candid) {
        return { kind: "name_taken" };
    } else {
        console.warn("CreateCommunit failed with", candid);
        return CommonResponses.failure;
    }
}

export function createGroupResponse(candid: ApiCreateGroupResponse): CreateGroupResponse {
    if ("Success" in candid) {
        return { kind: "success", canisterId: candid.Success.chat_id.toString() };
    }

    if ("NameTaken" in candid) {
        return { kind: "group_name_taken" };
    }

    if ("NameTooLong" in candid) {
        return { kind: "name_too_long" };
    }

    if ("NameTooShort" in candid) {
        return { kind: "name_too_short" };
    }

    if ("NameReserved" in candid) {
        return { kind: "name_reserved" };
    }

    if ("DescriptionTooLong" in candid) {
        return { kind: "description_too_long" };
    }

    if ("Throttled" in candid) {
        return { kind: "throttled" };
    }

    if ("InternalError" in candid) {
        return { kind: "internal_error" };
    }

    if ("AvatarTooBig" in candid) {
        return { kind: "avatar_too_big" };
    }

    if ("MaxGroupsCreated" in candid) {
        // todo - make sure we handle this in the UI
        return { kind: "max_groups_created" };
    }

    if ("RulesTooLong" in candid) {
        return { kind: "rules_too_long" };
    }

    if ("RulesTooShort" in candid) {
        return { kind: "rules_too_short" };
    }

    if ("UserSuspended" in candid) {
        return { kind: "user_suspended" };
    }

    if ("UnauthorizedToCreatePublicGroup" in candid) {
        return { kind: "unauthorized_to_create_public_group" };
    }

    throw new UnsupportedValueError("Unexpected ApiCreateGroupResponse type received", candid);
}

export function deleteGroupResponse(candid: ApiDeleteGroupResponse): DeleteGroupResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("InternalError" in candid) {
        return "internal_error";
    }
    if ("NotAuthorized" in candid) {
        return "not_authorized";
    }
    if ("UserSuspended" in candid) {
        return "user_suspended";
    }
    if ("ChatFrozen" in candid) {
        return "chat_frozen";
    }
    throw new UnsupportedValueError("Unexpected ApiDeleteGroupResponse type received", candid);
}

export async function getEventsResponse(
    principal: Principal,
    candid: ApiEventsResponse,
    chatId: string,
    latestClientEventIndexPreRequest: number | undefined
): Promise<EventsResponse<DirectChatEvent>> {
    if ("Success" in candid) {
        const latestEventIndex = candid.Success.latest_event_index;

        await ensureReplicaIsUpToDate(
            principal,
            chatId,
            undefined,
            latestClientEventIndexPreRequest,
            latestEventIndex
        );

        return {
            events: candid.Success.events.map(event),
            latestEventIndex,
        };
    }
    if ("ChatNotFound" in candid) {
        return "events_failed";
    }
    if ("ReplicaNotUpToDate" in candid) {
        throw ReplicaNotUpToDateError.byEventIndex(
            candid.ReplicaNotUpToDate,
            latestClientEventIndexPreRequest ?? -1,
            false
        );
    }

    throw new UnsupportedValueError("Unexpected ApiEventsResponse type received", candid);
}

function event(candid: ApiDirectChatEventWrapper): EventWrapper<DirectChatEvent> {
    return {
        event: directChatEvent(candid.event),
        index: candid.index,
        timestamp: candid.timestamp,
    };
}

function directChatEvent(candid: ApiDirectChatEvent): DirectChatEvent {
    if ("Message" in candid) {
        return message(candid.Message);
    }

    if ("DirectChatCreated" in candid) {
        return {
            kind: "direct_chat_created",
        };
    }

    if ("MessageReactionAdded" in candid) {
        return {
            kind: "reaction_added",
            message: updatedMessage(candid.MessageReactionAdded),
        };
    }

    if ("MessageDeleted" in candid) {
        return {
            kind: "message_deleted",
            message: updatedMessage(candid.MessageDeleted),
        };
    }

    if ("MessageUndeleted" in candid) {
        return {
            kind: "message_undeleted",
            message: updatedMessage(candid.MessageUndeleted),
        };
    }

    if ("MessageEdited" in candid) {
        return {
            kind: "message_edited",
            message: updatedMessage(candid.MessageEdited),
        };
    }

    if ("MessageReactionRemoved" in candid) {
        return {
            kind: "reaction_removed",
            message: updatedMessage(candid.MessageReactionRemoved),
        };
    }

    if ("PollVoteRegistered" in candid) {
        return {
            kind: "poll_vote_registered",
            message: updatedMessage(candid.PollVoteRegistered),
        };
    }

    if ("PollVoteDeleted" in candid) {
        return {
            kind: "poll_vote_deleted",
            message: updatedMessage(candid.PollVoteDeleted),
        };
    }

    if ("PollEnded" in candid) {
        return {
            kind: "poll_ended",
            messageIndex: candid.PollEnded.message_index,
            eventIndex: candid.PollEnded.event_index,
        };
    }

    if ("ThreadUpdated" in candid) {
        return {
            kind: "thread_updated",
            messageIndex: candid.ThreadUpdated.message_index,
            eventIndex: candid.ThreadUpdated.event_index,
        };
    }

    // todo - we know there are other event types that we are not dealing with yet
    throw new Error(`Unexpected ApiEventWrapper type received: ${JSON.stringify(candid)}`);
}

function cachedGroupChatSummaries(candid: ApiCachedGroupChatSummaries): CachedGroupChatSummaries {
    return {
        summaries: candid.summaries.map((s) => groupChatSummary(s, true)),
        timestamp: candid.timestamp,
    };
}

function groupChatsInitial(candid: ApiGroupChatsInitial): GroupChatsInitial {
    return {
        summaries: candid.summaries.map(userCanisterGroupSummary),
        pinned: candid.pinned.map((c) => c.toString()),
        cached: optional(candid.cached, cachedGroupChatSummaries),
    };
}

function directChatsInitial(candid: ApiDirectChatsInitial): DirectChatsInitial {
    return {
        summaries: candid.summaries.map(directChatSummary),
        pinned: candid.pinned.map((c) => c.toString()),
    };
}

function userCanisterChannelSummary(
    candid: ApiUserCanisterChannelSummary
): UserCanisterChannelSummary {
    return {
        channelId: candid.channel_id.toString(),
        readByMeUpTo: optional(candid.read_by_me_up_to, identity),
        dateReadPinned: optional(candid.date_read_pinned, identity),
        threadsRead: candid.threads_read,
        archived: candid.archived,
    };
}

function userCanisterCommunitySummary(
    candid: ApiUserCanisterCommunitySummary
): UserCanisterCommunitySummary {
    return {
        communityId: candid.community_id.toString(),
        channels: candid.channels.map(userCanisterChannelSummary),
        pinnedChannels: candid.pinned.map((p) => p.toString()),
        archived: candid.archived,
    };
}

function communitiesInitial(candid: ApiCommunitiesInitial): CommunitiesInitial {
    return {
        summaries: candid.summaries.map(userCanisterCommunitySummary),
    };
}

function chatIndentifier(candid: ApiChat): ChatIdentifier {
    if ("Group" in candid) {
        return { kind: "group", chatId: candid.Group.toString() };
    }
    if ("Direct" in candid) {
        return { kind: "direct", chatId: candid.Direct.toString() };
    }
    if ("Channel" in candid) {
        return {
            kind: "channel",
            communtityId: candid.Channel[0].toString(),
            channelId: candid.Channel[1].toString(),
        };
    }
    throw new UnsupportedValueError("Unexpected ApiChat type received", candid);
}

function favouriteChatsInitial(candid: ApiFavouriteChatsInitial): FavouriteChatsInitial {
    return {
        chats: candid.chats.map(chatIndentifier),
        pinned: candid.pinned.map(chatIndentifier),
    };
}

export function initialStateResponse(candid: ApiInitialStateResponse): InitialStateResponse {
    if ("Success" in candid) {
        const result = candid.Success;
        return {
            blockedUsers: result.blocked_users.map((u) => u.toString()),
            communities: communitiesInitial(candid.Success.communities),
            groupChats: groupChatsInitial(candid.Success.group_chats),
            favouriteChats: favouriteChatsInitial(candid.Success.favourite_chats),
            avatarId: optional(result.avatar_id, identity),
            directChats: directChatsInitial(candid.Success.direct_chats),
            timestamp: result.timestamp,
        };
    }
    throw new Error(`Unexpected ApiUpdatesResponse type received: ${candid}`);
}

export function userCanisterChannelSummaryUpdates(
    candid: ApiUserCanisterChannelSummaryUpdates
): UserCanisterChannelSummaryUpdates {
    return {
        channelId: candid.channel_id.toString(),
        readByMeUpTo: optional(candid.read_by_me_up_to, identity),
        dateReadPinned: optional(candid.date_read_pinned, identity),
        threadsRead: candid.threads_read.map(([idx1, idx2]) => [idx1, idx2]),
        archived: optional(candid.archived, identity),
    };
}

export function userCanisterCommunitySummaryUpdates(
    candid: ApiUserCanisterCommunitySummaryUpdates
): UserCanisterCommunitySummaryUpdates {
    return {
        communityId: candid.community_id.toString(),
        channels: candid.channels.map(userCanisterChannelSummaryUpdates),
        pinned: optional(candid.pinned, (p) => p.map((p) => p.toString())),
        archived: optional(candid.archived, identity),
    };
}

export function communitiesUpdates(candid: ApiCommunitiesUpdates): CommunitiesUpdates {
    return {
        added: candid.added.map(userCanisterCommunitySummary),
        updated: candid.updated.map(userCanisterCommunitySummaryUpdates),
        removed: candid.removed.map((c) => c.toString()),
    };
}

export function getUpdatesResponse(candid: ApiUpdatesResponse): UpdatesResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            timestamp: candid.Success.timestamp,
            blockedUsers: optional(candid.Success.blocked_users, (b) => b.map((u) => u.toString())),
            communities: communitiesUpdates(candid.Success.communities),
            favouriteChats: favouriteChatsUpdates(candid.Success.favourite_chats),
            groupChats: groupChatsUpdates(candid.Success.group_chats),
            avatarId: optionUpdate(candid.Success.avatar_id, identity),
            directChats: directChatsUpdates(candid.Success.direct_chats),
        };
    }

    if ("SuccessNoUpdates" in candid) {
        return {
            kind: "success_no_updates",
        };
    }

    throw new Error(`Unexpected ApiUpdatesResponse type received: ${candid}`);
}

function userCanisterGroupSummary(
    summary: ApiUserCanisterGroupChatSummary
): UserCanisterGroupChatSummary {
    return {
        chatId: summary.chat_id.toString(),
        readByMeUpTo: optional(summary.read_by_me_up_to, identity),
        threadsRead: summary.threads_read.reduce((curr, next) => {
            curr[next[0]] = next[1];
            return curr;
        }, {} as Record<number, number>),
        archived: summary.archived,
        dateReadPinned: optional(summary.date_read_pinned, identity),
    };
}

function userCanisterGroupSummaryUpdates(
    summary: ApiUserCanisterGroupChatSummaryUpdates
): UserCanisterGroupChatSummaryUpdates {
    return {
        chatId: summary.chat_id.toString(),
        readByMeUpTo: optional(summary.read_by_me_up_to, identity),
        threadsRead: summary.threads_read.reduce((curr, next) => {
            curr[next[0]] = next[1];
            return curr;
        }, {} as Record<number, number>),
        archived: optional(summary.archived, identity),
        dateReadPinned: optional(summary.date_read_pinned, identity),
    };
}

function directChatSummaryUpdates(candid: ApiDirectChatSummaryUpdates): DirectChatSummaryUpdates {
    return {
        kind: "direct_chat",
        chatId: candid.chat_id.toString(),
        readByMeUpTo: optional(candid.read_by_me_up_to, identity),
        readByThemUpTo: optional(candid.read_by_them_up_to, identity),
        latestMessage: optional(candid.latest_message, (ev) => ({
            index: ev.index,
            timestamp: ev.timestamp,
            event: message(ev.event),
        })),
        latestEventIndex: optional(candid.latest_event_index, identity),
        notificationsMuted: optional(candid.notifications_muted, identity),
        updatedEvents: candid.updated_events.map(updatedEvent),
        metrics: optional(candid.metrics, chatMetrics),
        myMetrics: optional(candid.my_metrics, chatMetrics),
        archived: optional(candid.archived, identity),
    };
}

function updatedEvent([eventIndex, timestamp]: [number, bigint]): UpdatedEvent {
    return {
        eventIndex,
        timestamp,
    };
}

function memberRole(candid: ApiGroupRole): MemberRole {
    if ("Admin" in candid) {
        return "admin";
    }
    if ("Moderator" in candid) {
        return "moderator";
    }
    if ("Participant" in candid) {
        return "participant";
    }
    if ("Owner" in candid) {
        return "owner";
    }
    throw new UnsupportedValueError("Unexpected ApiRole type received", candid);
}

function mention(candid: ApiMention): Mention {
    return {
        messageId: candid.message_id,
        messageIndex: candid.message_index,
        eventIndex: candid.event_index,
        mentionedBy: candid.mentioned_by.toString(),
    };
}

function groupChatSummary(candid: ApiGroupChatSummary, limitReadByMeUpTo = true): GroupChatSummary {
    const latestMessage = optional(candid.latest_message, (ev) => ({
        index: ev.index,
        timestamp: ev.timestamp,
        event: message(ev.event),
    }));
    return {
        kind: "group_chat",
        chatId: candid.chat_id.toString(),
        id: candid.chat_id.toString(),
        latestMessage,
        readByMeUpTo: optional(candid.read_by_me_up_to, (r) =>
            limitReadByMeUpTo && latestMessage !== undefined
                ? Math.min(latestMessage.event.messageIndex, r)
                : r
        ),
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
            canisterId: candid.chat_id.toString(),
        })),
        notificationsMuted: candid.notifications_muted,
        memberCount: candid.participant_count,
        myRole: memberRole(candid.role),
        mentions: candid.mentions
            .filter((m) => m.thread_root_message_index.length === 0)
            .map(mention),
        permissions: groupPermissions(candid.permissions),
        metrics: chatMetrics(candid.metrics),
        myMetrics: chatMetrics(candid.my_metrics),
        latestThreads: candid.latest_threads.map(threadSyncDetails),
        subtype: optional(candid.subtype, apiGroupSubtype),
        archived: candid.archived,
        previewed: false,
        frozen: candid.frozen.length > 0,
        dateLastPinned: optional(candid.date_last_pinned, identity),
        dateReadPinned: optional(candid.date_read_pinned, identity),
        gate: optional(candid.gate, accessGate) ?? { kind: "no_gate" },
        level: "group",
    };
}

function threadSyncDetails(candid: ApiThreadSyncDetails): ThreadSyncDetails {
    return {
        threadRootMessageIndex: candid.root_message_index,
        lastUpdated: candid.last_updated,
        readUpTo: optional(candid.read_up_to, identity),
        latestEventIndex: optional(candid.latest_event, identity) ?? -1,
        latestMessageIndex: optional(candid.latest_message, identity) ?? -1,
    };
}

function directChatSummary(candid: ApiDirectChatSummary): DirectChatSummary {
    return {
        kind: "direct_chat",
        chatId: candid.them.toString(),
        id: candid.them.toString(),
        latestMessage: {
            index: candid.latest_message.index,
            timestamp: candid.latest_message.timestamp,
            event: message(candid.latest_message.event),
        },
        them: candid.them.toString(),
        latestEventIndex: candid.latest_event_index,
        readByMeUpTo: optional(candid.read_by_me_up_to, identity),
        readByThemUpTo: optional(candid.read_by_them_up_to, identity),
        dateCreated: candid.date_created,
        notificationsMuted: candid.notifications_muted,
        metrics: chatMetrics(candid.metrics),
        myMetrics: chatMetrics(candid.my_metrics),
        archived: candid.archived,
    };
}

function failedNnsCryptoWithdrawal(
    candid: ApiNnsFailedCryptoTransaction
): FailedCryptocurrencyWithdrawal {
    return {
        kind: "failed",
        token: token(candid.token),
        to: "Account" in candid.to ? bytesToHexString(candid.to.Account) : "",
        amountE8s: candid.amount.e8s,
        feeE8s: candid.fee.e8s,
        memo: candid.memo,
        errorMessage: candid.error_message,
    };
}

function failedSnsCryptoWithdrawal(
    candid: ApiSnsFailedCryptoTransaction
): FailedCryptocurrencyWithdrawal {
    return {
        kind: "failed",
        token: token(candid.token),
        to: "Account" in candid.to ? formatIcrc1Account(candid.to.Account) : "",
        amountE8s: candid.amount.e8s,
        feeE8s: candid.fee.e8s,
        memo: candid.memo[0] ?? BigInt(0),
        errorMessage: candid.error_message,
    };
}

function completedNnsCryptoWithdrawal(
    candid: ApiNnsCompletedCryptoTransaction
): CompletedCryptocurrencyWithdrawal {
    return {
        kind: "completed",
        token: token(candid.token),
        to: "Account" in candid.to ? bytesToHexString(candid.to.Account) : "",
        amountE8s: candid.amount.e8s,
        feeE8s: candid.fee.e8s,
        memo: candid.memo,
        blockIndex: candid.block_index,
        transactionHash: bytesToHexString(candid.transaction_hash),
    };
}

function completedSnsCryptoWithdrawal(
    candid: ApiSnsCompletedCryptoTransaction
): CompletedCryptocurrencyWithdrawal {
    return {
        kind: "completed",
        token: token(candid.token),
        to: "Account" in candid.to ? formatIcrc1Account(candid.to.Account) : "",
        amountE8s: candid.amount.e8s,
        feeE8s: candid.fee.e8s,
        memo: candid.memo[0] ?? BigInt(0),
        blockIndex: candid.block_index,
        transactionHash: bytesToHexString(candid.transaction_hash),
    };
}

export function withdrawCryptoResponse(
    candid: ApiWithdrawCryptoResponse
): WithdrawCryptocurrencyResponse {
    if ("CurrencyNotSupported" in candid) {
        return { kind: "currency_not_supported" };
    }
    if ("TransactionFailed" in candid) {
        if ("NNS" in candid.TransactionFailed) {
            return failedNnsCryptoWithdrawal(candid.TransactionFailed.NNS);
        } else {
            return failedSnsCryptoWithdrawal(candid.TransactionFailed.SNS);
        }
    }
    if ("Success" in candid) {
        if ("NNS" in candid.Success) {
            return completedNnsCryptoWithdrawal(candid.Success.NNS);
        } else {
            return completedSnsCryptoWithdrawal(candid.Success.SNS);
        }
    }
    throw new UnsupportedValueError(
        "Unexpected ApiWithdrawCryptocurrencyResponse type received",
        candid
    );
}

export function migrateUserPrincipal(
    candid: ApiMigrateUserPrincipalResponse
): MigrateUserPrincipalResponse {
    if ("Success" in candid) return "success";
    if ("MigrationNotInitialized" in candid) return "migration_not_initialized";
    if ("MigrationAlreadyInProgress" in candid) return "migration_already_in_progress";
    if ("PrincipalAlreadyInUse" in candid) return "principal_already_in_use";
    if ("InternalError" in candid) return "internal_error";
    throw new UnsupportedValueError(
        "Unexpected ApiMigrateUserPrincipalResponse type received",
        candid
    );
}

function formatIcrc1Account(candid: ApiIcrc1Account): string {
    const owner = candid.owner.toString();
    const subaccount = optional(candid.subaccount, bytesToHexString);

    return subaccount !== undefined ? `${owner}:${subaccount}` : owner;
}

export function deletedMessageResponse(
    candid: ApiDeletedDirectMessageResponse
): DeletedDirectMessageResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            content: messageContent(candid.Success.content, "unknown"),
        };
    }
    if ("ChatNotFound" in candid) {
        return { kind: "chat_not_found" };
    }
    if ("NotAuthorized" in candid) {
        return { kind: "not_authorized" };
    }
    if ("MessageNotFound" in candid) {
        return { kind: "message_not_found" };
    }
    if ("MessageNotDeleted" in candid) {
        return { kind: "message_not_deleted" };
    }
    if ("MessageHardDeleted" in candid) {
        return { kind: "message_hard_deleted" };
    }
    throw new UnsupportedValueError(
        "Unexpected ApiDeletedDirectMessageResponse type received",
        candid
    );
}

export function setMessageReminderResponse(
    candid: ApiSetMessageReminderResponse
): SetMessageReminderResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("NotesTooLong" in candid) {
        return "notes_too_long";
    }
    if ("ReminderDateInThePast" in candid) {
        return "reminder_date_in_past";
    }
    if ("UserSuspended" in candid) {
        return "user_suspended";
    }
    throw new UnsupportedValueError(
        "Unexpected ApiSetMessageReminderResponse type received",
        candid
    );
}
