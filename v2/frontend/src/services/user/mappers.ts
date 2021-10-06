import type {
    ApiChatSummary,
    ApiEventsResponse,
    ApiUpdatesResponse,
    ApiParticipant,
    ApiCreateGroupResponse,
    ApiChatSummaryUpdates,
    ApiDirectChatEventWrapper,
    ApiSendMessageResponse,
    ApiPutChunkResponse,
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
} from "./candid/idl";
import type {
    ChatSummary,
    UpdatesResponse,
    EventsResponse,
    EventWrapper,
    Participant,
    ChatSummaryUpdates,
    CreateGroupResponse,
    DirectChatEvent,
    SendMessageResponse,
    PutChunkResponse,
    BlockUserResponse,
    UnblockUserResponse,
    LeaveGroupResponse,
    MarkReadResponse,
    SetAvatarResponse,
    ToggleReactionResponse,
    DeleteMessageResponse,
    JoinGroupResponse,
    EditMessageResponse,
} from "../../domain/chat/chat";
import { identity, optional } from "../../utils/mapping";
import { UnsupportedValueError } from "../../utils/error";
import { message, messageContent, updatedMessage } from "../common/chatMappers";
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
        eventIndex: candid.event_index,
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
    console.log(candid);
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

export function markReadResponse(candid: ApiMarkReadResponse): MarkReadResponse {
    if ("Success" in candid) {
        return candid.Success.unrecognised_message_ids;
    }
    if ("SuccessNoChange" in candid) {
        return candid.SuccessNoChange.unrecognised_message_ids;
    }
    if ("ChatNotFound" in candid) {
        return [];
    }
    throw new UnsupportedValueError("Unexpected ApiMarkReadResponse type received", candid);
}

export function leaveGroupResponse(candid: ApiLeaveGroupResponse): LeaveGroupResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("NotInGroup" in candid) {
        return "not_in_group";
    }
    if ("InternalError" in candid) {
        return "internal_error";
    }
    if ("GroupNotFound" in candid) {
        return "group_not_found";
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
    if ("GroupNotFound" in candid) {
        return "group_not_found";
    }
    throw new UnsupportedValueError("Unexpected ApiLeaveGroupResponse type received", candid);
}

export function putChunkResponse(candid: ApiPutChunkResponse): PutChunkResponse {
    if ("Full" in candid) {
        return "put_chunk_full";
    }
    if ("ChunkTooBig" in candid) {
        return "put_chunk_too_big";
    }
    if ("Success" in candid) {
        return "put_chunk_success";
    }
    if ("ChunkAlreadyExists" in candid) {
        return "chunk_already_exists";
    }
    if ("BlobAlreadyExists" in candid) {
        return "blob_already_exists";
    }
    if ("BlobTooBig" in candid) {
        return "blob_too_big";
    }
    throw new UnsupportedValueError("Unexpected ApiPutChunkResponse type received", candid);
}

export function blockResponse(
    candid: ApiBlockUserResponse | ApiUnblockUserResponse
): BlockUserResponse | UnblockUserResponse {
    console.log(candid);
    if ("Success" in candid) {
        return "success";
    }
    throw new UnsupportedValueError("Unexpected ApiBlockResponse type received", candid);
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
    if ("MessageTooLong" in candid) {
        return { kind: "message_too_long" };
    }
    if ("RecipientNotFound" in candid) {
        return { kind: "recipient_not_found" };
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

    throw new UnsupportedValueError("Unexpected ApiCreateGroupResponse type received", candid);
}

export function getEventsResponse(candid: ApiEventsResponse): EventsResponse<DirectChatEvent> {
    if ("Success" in candid) {
        console.log("Events: ", candid.Success.events);
        return {
            events: candid.Success.events.map(event),
            affectedEvents: candid.Success.affected_events.map(event),
        };
    }
    if ("ChatNotFound" in candid) {
        return "chat_not_found";
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

export function getUpdatesResponse(candid: ApiUpdatesResponse): UpdatesResponse {
    if ("Success" in candid) {
        return {
            blockedUsers: new Set(candid.Success.blocked_users.map((u) => u.toString())),
            chatsUpdated: candid.Success.chats_updated.map(updatedChatSummary),
            chatsAdded: candid.Success.chats_added.map(chatSummary),
            chatsRemoved: new Set(candid.Success.chats_removed.map((p) => p.toString())),
            timestamp: candid.Success.timestamp,
        };
    }
    throw new Error(`Unexpected ApiUpdatesResponse type received: ${candid}`);
}

function updatedChatSummary(candid: ApiChatSummaryUpdates): ChatSummaryUpdates {
    if ("Group" in candid) {
        const chatId = candid.Group.chat_id.toString();
        return {
            kind: "group_chat",
            chatId,
            lastUpdated: candid.Group.last_updated,
            readByMe: optional(candid.Group.read_by_me, identity),
            latestMessage: optional(candid.Group.latest_message, (ev) => ({
                index: ev.index,
                timestamp: ev.timestamp,
                event: message(ev.event),
            })),
            name: optional(candid.Group.name, identity),
            description: optional(candid.Group.description, identity),
            participantsAddedOrUpdated: candid.Group.participants_added_or_updated.map(participant),
            participantsRemoved: new Set(
                candid.Group.participants_removed.map((p) => p.toString())
            ),
            latestEventIndex: optional(candid.Group.latest_event_index, identity),
            avatarBlobReference: optional(candid.Group.avatar_id, (blobId) => ({
                blobId,
                canisterId: chatId,
            })),
        };
    }
    if ("Direct" in candid) {
        const chatId = candid.Direct.chat_id.toString();
        return {
            kind: "direct_chat",
            chatId,
            readByMe: optional(candid.Direct.read_by_me, identity),
            readByThem: optional(candid.Direct.read_by_them, identity),
            latestMessage: optional(candid.Direct.latest_message, (ev) => ({
                index: ev.index,
                timestamp: ev.timestamp,
                event: message(ev.event),
            })),
            latestEventIndex: optional(candid.Direct.latest_event_index, identity),
        };
    }
    throw new UnsupportedValueError("Unexpected ApiChatSummaryUpdate type received", candid);
}

function chatSummary(candid: ApiChatSummary): ChatSummary {
    if ("Group" in candid) {
        const participants = candid.Group.participants.map(participant);
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
            readByMe: candid.Group.read_by_me,
            name: candid.Group.name,
            description: candid.Group.description,
            participants,
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
            readByMe: candid.Direct.read_by_me,
            readByThem: candid.Direct.read_by_them,
            dateCreated: candid.Direct.date_created,
        };
    }
    throw new UnsupportedValueError("Unexpected ApiChatSummary type received", candid);
}

function participant(candid: ApiParticipant): Participant {
    return {
        role: "Admin" in candid.role ? "admin" : "standard",
        userId: candid.user_id.toString(),
    };
}
