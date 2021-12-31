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
    ApiSearchAllMessagesResponse,
    ApiMessageMatch,
    ApiEditMessageResponse,
    ApiInitialStateResponse,
    ApiAlert,
    ApiAlertDetails,
    ApiCryptocurrencyDeposit,
    ApiRole,
    ApiMention,
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
    ParticipantRole,
    Mention,
} from "../../domain/chat/chat";
import { identity, optional } from "../../utils/mapping";
import { UnsupportedValueError } from "../../utils/error";
import {
    apiMessageIndexRanges,
    message,
    messageContent,
    updatedMessage,
} from "../common/chatMappers";
import type { MessageMatch, SearchAllMessagesResponse } from "../../domain/search/search";

export function searchAllMessageResponse(
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
        "Unknown UserIndex.ApiSearchAllMessagesResponse type received",
        candid
    );
}

function messageMatch(candid: ApiMessageMatch): MessageMatch {
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
        return "success";
    }
    if ("Blocked" in candid) {
        return "blocked";
    }
    if ("AlreadyInGroup" in candid) {
        return "already_in_group";
    }
    if ("GroupNotPublic" in candid) {
        return "group_not_public";
    }
    if ("InternalError" in candid) {
        return "internal_error";
    }
    if ("ParticipantLimitReached" in candid) {
        // todo - check if we need to deal with this in the UI
        return "participant_limit_reached";
    }
    if ("GroupNotFound" in candid) {
        return "group_not_found";
    }
    if ("NotSuperAdmin" in candid) {
        return "not_super_admin";
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

export function sendMessageResponse(candid: ApiSendMessageResponse): SendMessageResponse {
    if ("BalanceExceeded" in candid) {
        return { kind: "balance_exceeded" };
    }
    if ("Success" in candid) {
        return {
            kind: "success",
            timestamp: candid.Success.timestamp,
            messageIndex: candid.Success.message_index,
            eventIndex: candid.Success.event_index,
        };
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
    if ("TransactionFailed" in candid) {
        return { kind: "transaction_failed" };
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
    if ("ICP" in candid) {
        return {
            transferKind: "icp_deposit",
            kind: "completed_icp_deposit",
            amountE8s: candid.ICP.Completed.amount_e8s,
            feeE8s: candid.ICP.Completed.fee_e8s,
            memo: candid.ICP.Completed.memo,
            blockHeight: candid.ICP.Completed.block_height,
        };
    }
    if ("Cycles" in candid) {
        return {
            transferKind: "cycles_deposit",
            kind: "completed_cycles_deposit",
            from: candid.Cycles.Completed.from.toString(),
            cycles: candid.Cycles.Completed.cycles,
        };
    }
    throw new UnsupportedValueError("Unexpected ApiAlertDetails type received:", candid);
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
            avatarBlobReference: optional(candid.Group.avatar_id, (blobId) => ({
                blobId,
                canisterId: chatId,
            })),
            notificationsMuted: optional(candid.Group.notifications_muted, identity),
            participantCount: optional(candid.Group.participant_count, identity),
            myRole: optional(candid.Group.role, participantRole),
            mentions: candid.Group.mentions.map(mention),
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
        };
    }
    throw new UnsupportedValueError("Unexpected ApiChatSummaryUpdate type received", candid);
}

function participantRole(candid: ApiRole): ParticipantRole {
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
        return {
            kind: "group_chat",
            chatId: candid.Group.chat_id.toString(),
            latestMessage: optional(candid.Group.latest_message, (ev) => {
                return {
                    index: ev.index,
                    timestamp: ev.timestamp,
                    event: message(ev.event),
                };
            }),
            readByMe: apiMessageIndexRanges(candid.Group.read_by_me),
            name: candid.Group.name,
            description: candid.Group.description,
            public: candid.Group.is_public,
            joined: candid.Group.joined,
            minVisibleEventIndex: candid.Group.min_visible_event_index,
            minVisibleMessageIndex: candid.Group.min_visible_message_index,
            latestEventIndex: candid.Group.latest_event_index,
            lastUpdated: candid.Group.last_updated,
            blobReference: optional(candid.Group.avatar_id, (blobId) => ({
                blobId,
                canisterId: candid.Group.chat_id.toString(),
            })),
            notificationsMuted: candid.Group.notifications_muted,
            participantCount: candid.Group.participant_count,
            myRole: participantRole(candid.Group.role),
            mentions: candid.Group.mentions.map(mention),
        };
    }
    if ("Direct" in candid) {
        return {
            kind: "direct_chat",
            chatId: candid.Direct.them.toString(),
            latestMessage: {
                index: candid.Direct.latest_message.index,
                timestamp: candid.Direct.latest_message.timestamp,
                event: message(candid.Direct.latest_message.event),
            },
            them: candid.Direct.them.toString(),
            latestEventIndex: candid.Direct.latest_event_index,
            readByMe: apiMessageIndexRanges(candid.Direct.read_by_me),
            readByThem: apiMessageIndexRanges(candid.Direct.read_by_them),
            dateCreated: candid.Direct.date_created,
            notificationsMuted: candid.Direct.notifications_muted,
        };
    }
    throw new UnsupportedValueError("Unexpected ApiChatSummary type received", candid);
}
