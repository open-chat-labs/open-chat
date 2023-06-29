import type {
    ApiEventsResponse,
    ApiDirectChatEventWrapper,
    ApiSendMessageResponse,
    ApiBlockUserResponse,
    ApiUnblockUserResponse,
    ApiMarkReadResponse,
    ApiSetAvatarResponse,
    ApiDirectChatEvent,
    ApiDeleteMessageResponse,
    ApiUndeleteMessageResponse,
    ApiSearchDirectChatResponse,
    ApiMessageMatch,
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
    ApiIcrc1FailedCryptoTransaction,
    ApiIcrc1CompletedCryptoTransaction,
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
    ApiFavouriteChatsUpdates,
    ApiGroupChatsUpdates,
    ApiDirectChatsUpdates,
} from "./candid/idl";
import {
    EventsResponse,
    EventWrapper,
    DirectChatEvent,
    SendMessageResponse,
    BlockUserResponse,
    UnblockUserResponse,
    MarkReadResponse,
    SetAvatarResponse,
    DeleteMessageResponse,
    UndeleteMessageResponse,
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
    FavouriteChatsUpdates,
    GroupChatsUpdates,
    DirectChatsUpdates,
    DirectChatIdentifier,
    nullMembership,
} from "openchat-shared";
import {
    bytesToBigint,
    bytesToHexString,
    identity,
    optional,
    optionUpdate
} from "../../utils/mapping";
import {
    apiGroupSubtype,
    chatMetrics,
    completedCryptoTransfer,
    accessGate,
    groupPermissions,
    message,
    messageContent,
    token,
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
    chatId: DirectChatIdentifier
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

export function messageMatch(candid: ApiMessageMatch, chatId: ChatIdentifier): MessageMatch {
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
    } else {
        console.warn("Unexpected ApiDeleteMessageResponse type received", candid);
        return "failure";
    }
}

export function undeleteMessageResponse(
    candid: ApiUndeleteMessageResponse
): UndeleteMessageResponse {
    if ("Success" in candid) {
        if (candid.Success.messages.length == 0) {
            return CommonResponses.failure;
        } else {
            return {
                kind: "success",
                message: message(candid.Success.messages[0]),
            };
        }
    } else {
        console.warn("Unexpected ApiUndeleteMessageResponse type received", candid);
        return CommonResponses.failure;
    }
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

export function sendMessageWithTransferToGroupResponse(
    candid: ApiSendMessageWithTransferToGroupResponse,
    sender: string,
    recipient: string
): SendMessageResponse {
    if ("Success" in candid) {
        return {
            kind: "transfer_success",
            timestamp: candid.Success.timestamp,
            messageIndex: candid.Success.message_index,
            eventIndex: candid.Success.event_index,
            transfer: completedCryptoTransfer(candid.Success.transfer, sender, recipient),
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
        return {
            kind: "transfer_success",
            timestamp: candid.TransferSuccessV2.timestamp,
            messageIndex: candid.TransferSuccessV2.message_index,
            eventIndex: candid.TransferSuccessV2.event_index,
            transfer: completedCryptoTransfer(candid.TransferSuccessV2.transfer, sender, recipient),
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

export async function getEventsResponse(
    principal: Principal,
    candid: ApiEventsResponse,
    chatId: DirectChatIdentifier,
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

    if ("Empty" in candid) {
        return {
            kind: "empty",
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
    candid: ApiUserCanisterChannelSummary,
    communityId: string
): UserCanisterChannelSummary {
    return {
        id: {
            kind: "channel",
            communityId: communityId,
            channelId: candid.channel_id.toString(),
        },
        readByMeUpTo: optional(candid.read_by_me_up_to, identity),
        dateReadPinned: optional(candid.date_read_pinned, identity),
        threadsRead: candid.threads_read.reduce((curr, next) => {
            curr[next[0]] = next[1];
            return curr;
        }, {} as Record<number, number>),
        archived: candid.archived,
    };
}

function userCanisterCommunitySummary(
    candid: ApiUserCanisterCommunitySummary
): UserCanisterCommunitySummary {
    const communityId = candid.community_id.toString();
    return {
        id: { kind: "community", communityId },
        channels: candid.channels.map((c) => userCanisterChannelSummary(c, communityId)),
        pinned: candid.pinned.map((p) => ({
            kind: "channel",
            communityId,
            channelId: p.toString(),
        })),
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
        return { kind: "group_chat", groupId: candid.Group.toString() };
    }
    if ("Direct" in candid) {
        return { kind: "direct_chat", userId: candid.Direct.toString() };
    }
    if ("Channel" in candid) {
        return {
            kind: "channel",
            communityId: candid.Channel[0].toString(),
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
    candid: ApiUserCanisterChannelSummaryUpdates,
    communityId: string
): UserCanisterChannelSummaryUpdates {
    return {
        id: { kind: "channel", communityId, channelId: candid.channel_id.toString() },
        readByMeUpTo: optional(candid.read_by_me_up_to, identity),
        dateReadPinned: optional(candid.date_read_pinned, identity),
        threadsRead: candid.threads_read.reduce((curr, next) => {
            curr[next[0]] = next[1];
            return curr;
        }, {} as Record<number, number>),
        archived: optional(candid.archived, identity),
    };
}

export function userCanisterCommunitySummaryUpdates(
    candid: ApiUserCanisterCommunitySummaryUpdates
): UserCanisterCommunitySummaryUpdates {
    const communityId = candid.community_id.toString();
    return {
        id: { kind: "community", communityId },
        channels: candid.channels.map((c) => userCanisterChannelSummaryUpdates(c, communityId)),
        pinned: optional(candid.pinned, (p) =>
            p.map((p) => ({ kind: "channel", communityId, channelId: p.toString() }))
        ),
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

export function favouriteChatsUpdates(candid: ApiFavouriteChatsUpdates): FavouriteChatsUpdates {
    return {
        chats: optional(candid.chats, (c) => c.map(chatIndentifier)),
        pinned: optional(candid.pinned, (c) => c.map(chatIndentifier)),
    };
}

export function groupChatsUpdates(candid: ApiGroupChatsUpdates): GroupChatsUpdates {
    return {
        added: candid.added.map(userCanisterGroupSummary),
        pinned: optional(candid.pinned, (p) => p.map((p) => p.toString())),
        updated: candid.updated.map(userCanisterGroupSummaryUpdates),
        removed: candid.removed.map((c) => c.toString()),
    };
}

export function directChatsUpdates(candid: ApiDirectChatsUpdates): DirectChatsUpdates {
    return {
        added: candid.added.map(directChatSummary),
        pinned: optional(candid.pinned, (p) => p.map((p) => p.toString())),
        updated: candid.updated.map(directChatSummaryUpdates),
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
        id: { kind: "group_chat", groupId: summary.chat_id.toString() },
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
        id: { kind: "group_chat", groupId: summary.chat_id.toString() },
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
        id: { kind: "direct_chat", userId: candid.chat_id.toString() },
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
        return "member";
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
        id: { kind: "group_chat", groupId: candid.chat_id.toString() },
        kind: "group_chat",
        latestMessage,
        name: candid.name,
        description: candid.description,
        public: candid.is_public,
        historyVisible: candid.history_visible_to_new_joiners,
        minVisibleEventIndex: candid.min_visible_event_index,
        minVisibleMessageIndex: candid.min_visible_message_index,
        latestEventIndex: candid.latest_event_index,
        lastUpdated: candid.last_updated,
        blobReference: optional(candid.avatar_id, (blobId) => ({
            blobId,
            canisterId: candid.chat_id.toString(),
        })),
        memberCount: candid.participant_count,
        permissions: groupPermissions(candid.permissions),
        metrics: chatMetrics(candid.metrics),
        subtype: optional(candid.subtype, apiGroupSubtype),
        previewed: false,
        frozen: candid.frozen.length > 0,
        dateLastPinned: optional(candid.date_last_pinned, identity),
        dateReadPinned: optional(candid.date_read_pinned, identity),
        gate: optional(candid.gate, accessGate) ?? { kind: "no_gate" },
        level: "group",
        membership: {
            joined: candid.joined,
            role: memberRole(candid.role),
            mentions: candid.mentions
                .filter((m) => m.thread_root_message_index.length === 0)
                .map(mention),
            latestThreads: candid.latest_threads.map(threadSyncDetails),
            myMetrics: chatMetrics(candid.my_metrics),
            notificationsMuted: candid.notifications_muted,
            readByMeUpTo: optional(candid.read_by_me_up_to, (r) =>
                limitReadByMeUpTo && latestMessage !== undefined
                    ? Math.min(latestMessage.event.messageIndex, r)
                    : r
            ),
            archived: candid.archived,
        },
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
        id: { kind: "direct_chat", userId: candid.them.toString() },
        kind: "direct_chat",
        latestMessage: {
            index: candid.latest_message.index,
            timestamp: candid.latest_message.timestamp,
            event: message(candid.latest_message.event),
        },
        them: { kind: "direct_chat", userId: candid.them.toString() },
        latestEventIndex: candid.latest_event_index,
        readByThemUpTo: optional(candid.read_by_them_up_to, identity),
        dateCreated: candid.date_created,
        metrics: chatMetrics(candid.metrics),
        membership: {
            ...nullMembership,
            role: "owner",
            myMetrics: chatMetrics(candid.my_metrics),
            notificationsMuted: candid.notifications_muted,
            readByMeUpTo: optional(candid.read_by_me_up_to, identity),
            archived: candid.archived,
        },
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

function failedIcrc1CryptoWithdrawal(
    candid: ApiIcrc1FailedCryptoTransaction
): FailedCryptocurrencyWithdrawal {
    return {
        kind: "failed",
        token: token(candid.token),
        to: "Account" in candid.to ? formatIcrc1Account(candid.to.Account) : "",
        amountE8s: candid.amount,
        feeE8s: candid.fee,
        memo: optional(candid.memo, bytesToBigint) ?? BigInt(0),
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

function completedIcrc1CryptoWithdrawal(
    candid: ApiIcrc1CompletedCryptoTransaction
): CompletedCryptocurrencyWithdrawal {
    return {
        kind: "completed",
        token: token(candid.token),
        to: "Account" in candid.to ? formatIcrc1Account(candid.to.Account) : "",
        amountE8s: candid.amount,
        feeE8s: candid.fee,
        memo: optional(candid.memo, bytesToBigint) ?? BigInt(0),
        blockIndex: candid.block_index,
        transactionHash: undefined,
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
        } else if ("SNS" in candid.TransactionFailed) {
            return failedSnsCryptoWithdrawal(candid.TransactionFailed.SNS);
        } else if ("ICRC1" in candid.TransactionFailed) {
            return failedIcrc1CryptoWithdrawal(candid.TransactionFailed.ICRC1);
        }
    }
    if ("Success" in candid) {
        if ("NNS" in candid.Success) {
            return completedNnsCryptoWithdrawal(candid.Success.NNS);
        } else if ("SNS" in candid.Success) {
            return completedSnsCryptoWithdrawal(candid.Success.SNS);
        } else if ("ICRC1" in candid.Success) {
            return completedIcrc1CryptoWithdrawal(candid.Success.ICRC1);
        }
    }
    throw new Error("Unexpected ApiWithdrawCryptocurrencyResponse type received");
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
