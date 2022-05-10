import type {
    ApiChatSummary,
    ApiEventsResponse,
    ApiUpdatesResponse,
    ApiCreateGroupResponse,
    ApiChatSummaryUpdates,
    ApiDirectChatEventWrapper,
    ApiSendMessageResponse,
    ApiBlockUserResponse,
    ApiUnblockUserResponse,
    ApiLeaveGroupResponse,
    ApiMarkReadResponse,
    ApiSetAvatarResponse,
    ApiToggleReactionResponse,
    ApiDirectChatEvent,
    ApiDeleteMessageResponse,
    ApiJoinGroupResponse,
    ApiSearchDirectChatResponse,
    ApiSearchAllMessagesResponse,
    ApiMessageMatch,
    ApiEditMessageResponse,
    ApiInitialStateResponse,
    ApiAlert,
    ApiAlertDetails,
    ApiCryptocurrencyDeposit,
    ApiRole,
    ApiMention,
    ApiRecommendedGroupsResponse,
    ApiSetBioResponse,
    ApiWithdrawCryptocurrencyResponse,
    ApiFailedCryptocurrencyWithdrawal,
    ApiCompletedCryptocurrencyWithdrawal,
    ApiCompletedCryptocurrencyTransfer,
    ApiTransferCryptocurrencyWithinGroupResponse,
    ApiChatMetrics,
} from "./candid/idl";
import type {
    ChatSummary,
    UpdatesResponse,
    EventsResponse,
    EventWrapper,
    ChatSummaryUpdates,
    CreateGroupResponse,
    DirectChatEvent,
    SendMessageResponse,
    BlockUserResponse,
    UnblockUserResponse,
    LeaveGroupResponse,
    MarkReadResponse,
    SetAvatarResponse,
    ToggleReactionResponse,
    DeleteMessageResponse,
    JoinGroupResponse,
    EditMessageResponse,
    InitialStateResponse,
    Alert,
    AlertDetails,
    CryptocurrencyDeposit,
    MemberRole,
    Mention,
    GroupChatSummary,
    DirectChatSummary,
    WithdrawCryptocurrencyResponse,
    FailedCryptocurrencyWithdrawal,
    CompletedCryptocurrencyWithdrawal,
    CompletedCryptocurrencyTransfer,
    ChatMetrics,
} from "../../domain/chat/chat";
import { bytesToHexString, identity, optional, optionUpdate } from "../../utils/mapping";
import { UnsupportedValueError } from "../../utils/error";
import {
    apiMessageIndexRanges,
    completedCryptoTransfer,
    groupPermissions,
    message,
    messageContent,
    publicGroupSummary,
    updatedMessage,
} from "../common/chatMappers";
import type {
    MessageMatch,
    SearchDirectChatResponse,
    SearchAllMessagesResponse,
} from "../../domain/search/search";
import type { SetBioResponse } from "../../domain/user/user";
import type { ApiDirectChatSummary, ApiGroupChatSummary } from "./candid/idl";

export function setBioResponse(candid: ApiSetBioResponse): SetBioResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("TooLong" in candid) {
        return "bio_too_long";
    }
    throw new UnsupportedValueError(`Unexpected ApiSetBioResponse type received`, candid);
}

export function recommendedGroupsResponse(
    candid: ApiRecommendedGroupsResponse
): GroupChatSummary[] {
    if ("Success" in candid) {
        return candid.Success.groups.map(publicGroupSummary);
    }
    if ("InternalError" in candid) {
        return [];
    }
    throw new UnsupportedValueError(
        `Unexpected ApiRecommendedGroupsResponse type received`,
        candid
    );
}

export function searchAllMessagesResponse(
    candid: ApiSearchAllMessagesResponse
): SearchAllMessagesResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            matches: candid.Success.matches.map(messageMatch),
        };
    }
    if ("TermTooShort" in candid) {
        return {
            kind: "term_too_short",
        };
    }
    if ("TermTooLong" in candid) {
        return {
            kind: "term_too_long",
        };
    }
    if ("InvalidTerm" in candid) {
        return {
            kind: "term_invalid",
        };
    }
    throw new UnsupportedValueError(
        "Unknown UserIndex.ApiSearchMessagesResponse type received",
        candid
    );
}

export function searchDirectChatResponse(
    candid: ApiSearchDirectChatResponse
): SearchDirectChatResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            matches: candid.Success.matches.map(messageMatch),
        };
    }
    if ("TermTooShort" in candid) {
        return {
            kind: "term_too_short",
        };
    }
    if ("TermTooLong" in candid) {
        return {
            kind: "term_too_long",
        };
    }
    if ("InvalidTerm" in candid) {
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

export function messageMatch(candid: ApiMessageMatch): MessageMatch {
    return {
        chatId: candid.chat_id.toString(),
        messageIndex: candid.message_index,
        content: messageContent(candid.content),
        sender: candid.sender.toString(),
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
    throw new UnsupportedValueError("Unexpected ApiDeleteMessageResponse type received", candid);
}

export function toggleReactionResponse(candid: ApiToggleReactionResponse): ToggleReactionResponse {
    if ("Added" in candid) {
        return "added";
    }
    if ("Removed" in candid) {
        return "removed";
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
    throw new UnsupportedValueError("Unexpected ApiToggleReactionResponse type received", candid);
}

export function setAvatarResponse(candid: ApiSetAvatarResponse): SetAvatarResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("AvatarTooBig" in candid) {
        return "avatar_too_big";
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
    throw new UnsupportedValueError("Unexpected ApiLeaveGroupResponse type received", candid);
}

export function joinGroupResponse(candid: ApiJoinGroupResponse): JoinGroupResponse {
    if ("Success" in candid) {
        return groupChatSummary(candid.Success);
    }
    if ("Blocked" in candid) {
        return { kind: "blocked" };
    }
    if ("AlreadyInGroup" in candid) {
        return { kind: "already_in_group" };
    }
    if ("GroupNotPublic" in candid) {
        return { kind: "group_not_public" };
    }
    if ("InternalError" in candid) {
        return { kind: "internal_error" };
    }
    if ("ParticipantLimitReached" in candid) {
        // todo - check if we need to deal with this in the UI
        return { kind: "participant_limit_reached" };
    }
    if ("GroupNotFound" in candid) {
        return { kind: "group_not_found" };
    }
    if ("NotSuperAdmin" in candid) {
        return { kind: "not_super_admin" };
    }
    throw new UnsupportedValueError("Unexpected ApiLeaveGroupResponse type received", candid);
}

export function blockResponse(_candid: ApiBlockUserResponse): BlockUserResponse {
    return "success";
}

export function unblockResponse(_candid: ApiUnblockUserResponse): UnblockUserResponse {
    return "success";
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
    throw new UnsupportedValueError("Unexpected ApiEditMessageResponse type received", candid);
}

export function transferWithinGroupResponse(
    candid: ApiTransferCryptocurrencyWithinGroupResponse
): SendMessageResponse {
    if ("Success" in candid) {
        return {
            kind: "transfer_success",
            timestamp: candid.Success.timestamp,
            messageIndex: candid.Success.message_index,
            eventIndex: candid.Success.event_index,
            transfer: completedCryptoTransfer(candid.Success.transfer),
        };
    }
    if ("TransferCannotBeZero" in candid) {
        return { kind: "transfer_cannot_be_zero" };
    }
    if ("RecipientBlocked" in candid) {
        return { kind: "recipient_blocked" };
    }
    if ("InvalidRequest" in candid) {
        return { kind: "invalid_request" };
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
    throw new UnsupportedValueError("Unexpected ApiSendMessageResponse type received", candid);
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
    if ("TransferSuccessV2" in candid) {
        return {
            kind: "transfer_success",
            timestamp: candid.TransferSuccessV2.timestamp,
            messageIndex: candid.TransferSuccessV2.message_index,
            eventIndex: candid.TransferSuccessV2.event_index,
            transfer: completedCryptoTransfer(candid.TransferSuccessV2.transfer),
        };
    }
    if ("TransferCannotBeZero" in candid) {
        return { kind: "transfer_cannot_be_zero" };
    }
    if ("RecipientBlocked" in candid) {
        return { kind: "recipient_blocked" };
    }
    if ("InvalidRequest" in candid) {
        return { kind: "invalid_request" };
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
    throw new UnsupportedValueError("Unexpected ApiSendMessageResponse type received", candid);
}

export function createGroupResponse(candid: ApiCreateGroupResponse): CreateGroupResponse {
    if ("Success" in candid) {
        return { kind: "success", canisterId: candid.Success.chat_id.toString() };
    }

    if ("NameTaken" in candid) {
        return { kind: "group_name_taken" };
    }

    if ("InvalidName" in candid) {
        return { kind: "invalid_name" };
    }

    if ("NameTooLong" in candid) {
        return { kind: "name_too_long" };
    }

    if ("NameTooShort" in candid) {
        return { kind: "name_too_short" };
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

    throw new UnsupportedValueError("Unexpected ApiCreateGroupResponse type received", candid);
}

export function getEventsResponse(candid: ApiEventsResponse): EventsResponse<DirectChatEvent> {
    if ("Success" in candid) {
        return {
            events: candid.Success.events.map(event),
            affectedEvents: candid.Success.affected_events.map(event),
        };
    }
    if ("ChatNotFound" in candid) {
        return "events_failed";
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
    // todo - we know there are other event types that we are not dealing with yet
    throw new Error(`Unexpected ApiEventWrapper type received: ${JSON.stringify(candid)}`);
}

export function initialStateResponse(candid: ApiInitialStateResponse): InitialStateResponse {
    if ("Success" in candid) {
        return {
            blockedUsers: new Set(candid.Success.blocked_users.map((u) => u.toString())),
            chats: candid.Success.chats.map(chatSummary),
            timestamp: candid.Success.timestamp,
            cyclesBalance: candid.Success.cycles_balance,
        };
    }
    throw new Error(`Unexpected ApiUpdatesResponse type received: ${candid}`);
}

export function getUpdatesResponse(candid: ApiUpdatesResponse): UpdatesResponse {
    if ("Success" in candid) {
        return {
            blockedUsers: new Set(candid.Success.blocked_users.map((u) => u.toString())),
            chatsUpdated: candid.Success.chats_updated.map(updatedChatSummary),
            chatsAdded: candid.Success.chats_added.map(chatSummary),
            chatsRemoved: new Set(candid.Success.chats_removed.map((p) => p.toString())),
            avatarIdUpdate: optionUpdate(candid.Success.avatar_id, (id) => id),
            timestamp: candid.Success.timestamp,
            cyclesBalance: optional(candid.Success.cycles_balance, identity),
            transactions: [], // todo - come back when we need this
            alerts: candid.Success.alerts.map(alert),
        };
    }
    throw new Error(`Unexpected ApiUpdatesResponse type received: ${candid}`);
}

function alert(candid: ApiAlert): Alert {
    return {
        id: candid.id,
        details: alertDetails(candid.details),
        elapsed: candid.elapsed,
    };
}

function alertDetails(candid: ApiAlertDetails): AlertDetails {
    if ("GroupDeleted" in candid) {
        return {
            kind: "group_deleted_alert",
            deletedBy: candid.GroupDeleted.deleted_by.toString(),
            chatId: candid.GroupDeleted.chat_id.toString(),
        };
    }
    if ("RemovedFromGroup" in candid) {
        return {
            kind: "removed_from_group_alert",
            removedBy: candid.RemovedFromGroup.removed_by.toString(),
            chatId: candid.RemovedFromGroup.chat_id.toString(),
        };
    }
    if ("BlockedFromGroup" in candid) {
        return {
            kind: "blocked_from_group_alert",
            blockedBy: candid.BlockedFromGroup.removed_by.toString(),
            chatId: candid.BlockedFromGroup.chat_id.toString(),
        };
    }
    if ("CryptocurrencyDepositReceived" in candid) {
        return cryptoDepositAlert(candid.CryptocurrencyDepositReceived);
    }
    throw new UnsupportedValueError("Unexpected ApiAlertDetails type received:", candid);
}

function cryptoDepositAlert(candid: ApiCryptocurrencyDeposit): CryptocurrencyDeposit {
    return {
        transferKind: "icp_deposit",
        kind: "completed_icp_deposit",
        amountE8s: candid.Completed.amount.e8s,
        feeE8s: candid.Completed.fee.e8s,
        memo: candid.Completed.memo,
        blockIndex: candid.Completed.block_index,
    };
}

function updatedChatSummary(candid: ApiChatSummaryUpdates): ChatSummaryUpdates {
    if ("Group" in candid) {
        const chatId = candid.Group.chat_id.toString();
        return {
            kind: "group_chat",
            chatId,
            lastUpdated: candid.Group.last_updated,
            readByMe: optional(candid.Group.read_by_me, apiMessageIndexRanges),
            latestMessage: optional(candid.Group.latest_message, (ev) => ({
                index: ev.index,
                timestamp: ev.timestamp,
                event: message(ev.event),
            })),
            name: optional(candid.Group.name, identity),
            description: optional(candid.Group.description, identity),
            latestEventIndex: optional(candid.Group.latest_event_index, identity),
            avatarBlobReferenceUpdate: optionUpdate(candid.Group.avatar_id, (blobId) => ({
                blobId,
                canisterId: chatId,
            })),
            notificationsMuted: optional(candid.Group.notifications_muted, identity),
            participantCount: optional(candid.Group.participant_count, identity),
            myRole: optional(candid.Group.role, participantRole),
            mentions: candid.Group.mentions.map(mention),
            ownerId: optional(candid.Group.owner_id, (id) => id.toString()),
            permissions: optional(candid.Group.permissions, (permissions) =>
                groupPermissions(permissions)
            ),
            affectedEvents: candid.Group.affected_events,
            metrics: optional(candid.Group.metrics, chatMetrics),
            myMetrics: optional(candid.Group.my_metrics, chatMetrics),
            public: optional(candid.Group.is_public, identity),
        };
    }
    if ("Direct" in candid) {
        const chatId = candid.Direct.chat_id.toString();
        return {
            kind: "direct_chat",
            chatId,
            readByMe: optional(candid.Direct.read_by_me, apiMessageIndexRanges),
            readByThem: optional(candid.Direct.read_by_them, apiMessageIndexRanges),
            latestMessage: optional(candid.Direct.latest_message, (ev) => ({
                index: ev.index,
                timestamp: ev.timestamp,
                event: message(ev.event),
            })),
            latestEventIndex: optional(candid.Direct.latest_event_index, identity),
            notificationsMuted: optional(candid.Direct.notifications_muted, identity),
            affectedEvents: candid.Direct.affected_events,
            metrics: optional(candid.Direct.metrics, chatMetrics),
            myMetrics: optional(candid.Direct.my_metrics, chatMetrics),
        };
    }
    throw new UnsupportedValueError("Unexpected ApiChatSummaryUpdate type received", candid);
}

function participantRole(candid: ApiRole): MemberRole {
    if ("Admin" in candid) {
        return "admin";
    }
    if ("Participant" in candid) {
        return "participant";
    }
    if ("Owner" in candid) {
        return "owner";
    }
    if ("SuperAdmin" in candid) {
        return "super_admin";
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

function chatSummary(candid: ApiChatSummary): ChatSummary {
    if ("Group" in candid) {
        return groupChatSummary(candid.Group);
    }
    if ("Direct" in candid) {
        return directChatSummary(candid.Direct);
    }
    throw new UnsupportedValueError("Unexpected ApiChatSummary type received", candid);
}

function chatMetrics(candid: ApiChatMetrics): ChatMetrics {
    return {
        audioMessages: Number(candid.audio_messages),
        cyclesMessages: Number(candid.cycles_messages),
        edits: Number(candid.edits),
        icpMessages: Number(candid.icp_messages),
        giphyMessages: Number(candid.giphy_messages),
        deletedMessages: Number(candid.deleted_messages),
        fileMessages: Number(candid.file_messages),
        pollVotes: Number(candid.poll_votes),
        textMessages: Number(candid.text_messages),
        imageMessages: Number(candid.image_messages),
        replies: Number(candid.replies),
        videoMessages: Number(candid.video_messages),
        polls: Number(candid.polls),
        reactions: Number(candid.reactions),
    };
}

function groupChatSummary(candid: ApiGroupChatSummary): GroupChatSummary {
    return {
        kind: "group_chat",
        chatId: candid.chat_id.toString(),
        latestMessage: optional(candid.latest_message, (ev) => {
            return {
                index: ev.index,
                timestamp: ev.timestamp,
                event: message(ev.event),
            };
        }),
        readByMe: apiMessageIndexRanges(candid.read_by_me),
        name: candid.name,
        description: candid.description,
        public: candid.is_public,
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
        participantCount: candid.participant_count,
        myRole: participantRole(candid.role),
        mentions: candid.mentions.map(mention),
        ownerId: candid.owner_id.toString(),
        permissions: groupPermissions(candid.permissions),
        metrics: chatMetrics(candid.metrics),
        myMetrics: chatMetrics(candid.my_metrics),
    };
}

function directChatSummary(candid: ApiDirectChatSummary): DirectChatSummary {
    return {
        kind: "direct_chat",
        chatId: candid.them.toString(),
        latestMessage: {
            index: candid.latest_message.index,
            timestamp: candid.latest_message.timestamp,
            event: message(candid.latest_message.event),
        },
        them: candid.them.toString(),
        latestEventIndex: candid.latest_event_index,
        readByMe: apiMessageIndexRanges(candid.read_by_me),
        readByThem: apiMessageIndexRanges(candid.read_by_them),
        dateCreated: candid.date_created,
        notificationsMuted: candid.notifications_muted,
        metrics: chatMetrics(candid.metrics),
        myMetrics: chatMetrics(candid.my_metrics),
    };
}

export function failedCryptoWithdrawal(
    candid: ApiFailedCryptocurrencyWithdrawal
): FailedCryptocurrencyWithdrawal {
    return {
        transferKind: "icp_withdrawal",
        kind: "failed_icp_withdrawal",
        to: bytesToHexString(candid.to),
        amountE8s: candid.amount.e8s,
        feeE8s: candid.fee.e8s,
        memo: candid.memo,
        errorMessage: candid.error_message,
    };
}

export function completedCryptoWithdrawal(
    candid: ApiCompletedCryptocurrencyWithdrawal
): CompletedCryptocurrencyWithdrawal {
    return {
        transferKind: "icp_withdrawal",
        kind: "completed_icp_withdrawal",
        to: bytesToHexString(candid.to),
        amountE8s: candid.amount.e8s,
        feeE8s: candid.fee.e8s,
        memo: candid.memo,
        blockIndex: candid.block_index,
        transactionHash: bytesToHexString(candid.transaction_hash),
    };
}

export function withdrawCryptoResponse(
    candid: ApiWithdrawCryptocurrencyResponse
): WithdrawCryptocurrencyResponse {
    if ("CurrencyNotSupported" in candid) {
        return { kind: "currency_not_supported" };
    }
    if ("TransactionFailed" in candid) {
        return failedCryptoWithdrawal(candid.TransactionFailed);
    }
    if ("Success" in candid) {
        return completedCryptoWithdrawal(candid.Success);
    }
    throw new UnsupportedValueError(
        "Unexpected ApiWithdrawCryptocurrencyResponse type received",
        candid
    );
}
