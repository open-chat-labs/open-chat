import type {
    ApiAddParticipantsResponse,
    ApiBlobReference,
    ApiEventsResponse,
    ApiEventWrapper,
    ApiFileContent,
    ApiGroupMessage,
    ApiGroupReplyContext,
    ApiMediaContent,
    ApiMessageContent,
    ApiPutChunkResponse,
    ApiSendMessageResponse,
    ApiTextContent,
} from "./candid/idl";
import type {
    BlobReference,
    FileContent,
    EventsResponse,
    MediaContent,
    MessageContent,
    TextContent,
    EventWrapper,
    GroupChatEvent,
    GroupMessage,
    GroupChatReplyContext,
    CyclesContent,
    AddParticipantsResponse,
    SendMessageResponse,
    PutChunkResponse,
} from "../../domain/chat/chat";
import { identity, optional } from "../../utils/mapping";
import { UnsupportedValueError } from "../../utils/error";
import type { ApiCyclesContent } from "../user/candid/idl";
import { Principal } from "@dfinity/principal";

// todo - these message data types look very similar to the direct chat counterparts but they are logically separate and in
// some aspects actually different so we will map them independently for the time being
// this means that we may not be able to just have a /domain/chat module - it might not be that simple

function principalToString(p: Principal): string {
    return p.toString();
}

export function putChunkResponse(candid: ApiPutChunkResponse): PutChunkResponse {
    if ("Full" in candid) {
        return "put_chunk_full";
    }
    if ("Success" in candid) {
        return "put_chunk_success";
    }
    throw new UnsupportedValueError("Unexpected ApiPutChunkResponse type received", candid);
}

export function sendMessageResponse(candid: ApiSendMessageResponse): SendMessageResponse {
    if ("BalanceExceeded" in candid) {
        return { kind: "send_message_balance_exceeded" };
    }
    if ("Success" in candid) {
        return {
            kind: "send_message_success",
            timestamp: candid.Success.timestamp,
            messageIndex: candid.Success.message_index,
            eventIndex: candid.Success.event_index,
        };
    }
    if ("RecipientBlocked" in candid) {
        return { kind: "send_message_recipient_blocked" };
    }
    if ("InvalidRequest" in candid) {
        return { kind: "send_message_invalid_request" };
    }
    if ("SenderBlocked" in candid) {
        return { kind: "send_message_sender_blocked" };
    }
    if ("MessageTooLong" in candid) {
        return { kind: "send_message_too_long" };
    }
    if ("RecipientNotFound" in candid) {
        return { kind: "send_message_recipient_not_found" };
    }
    throw new UnsupportedValueError("Unexpected ApiSendMessageResponse type received", candid);
}

export function addParticipantsResponse(
    candid: ApiAddParticipantsResponse
): AddParticipantsResponse {
    if ("Failed" in candid) {
        return {
            kind: "add_participants_failed",
            usersAlreadyInGroup: candid.Failed.users_already_in_group.map(principalToString),
            usersBlockedFromGroup: candid.Failed.users_blocked_from_group.map(principalToString),
            usersWhoBlockedRequest: candid.Failed.users_who_blocked_request.map(principalToString),
            errors: candid.Failed.errors.map(principalToString),
        };
    }
    if ("PartialSuccess" in candid) {
        return {
            kind: "add_participants_partial_success",
            usersAdded: candid.PartialSuccess.users_added.map(principalToString),
            usersAlreadyInGroup:
                candid.PartialSuccess.users_already_in_group.map(principalToString),
            usersBlockedFromGroup:
                candid.PartialSuccess.users_blocked_from_group.map(principalToString),
            usersWhoBlockedRequest:
                candid.PartialSuccess.users_who_blocked_request.map(principalToString),
            errors: candid.PartialSuccess.errors.map(principalToString),
        };
    }
    if ("NotAuthorized" in candid) {
        return {
            kind: "add_participants_not_authorised",
        };
    }
    if ("Success" in candid) {
        return {
            kind: "add_participants_success",
        };
    }
    if ("NotInGroup" in candid) {
        return {
            kind: "add_participants_not_in_group",
        };
    }
    throw new UnsupportedValueError("Unexpected ApiAddParticipantsResponse type received", candid);
}

export function getEventsResponse(candid: ApiEventsResponse): EventsResponse<GroupChatEvent> {
    if ("Success" in candid) {
        return {
            events: candid.Success.events.map(event),
        };
    }
    if ("ChatNotFound" in candid) {
        return "chat_not_found";
    }
    throw new UnsupportedValueError("Unexpected ApiEventsResponse type received", candid);
}

function event(candid: ApiEventWrapper): EventWrapper<GroupChatEvent> {
    if ("Message" in candid.event) {
        return {
            event: message(candid.event.Message),
            index: candid.index,
            timestamp: candid.timestamp,
        };
    }
    if ("GroupChatCreated" in candid.event) {
        return {
            event: {
                kind: "group_chat_created",
                name: candid.event.GroupChatCreated.name,
                description: candid.event.GroupChatCreated.description,
                created_by: candid.event.GroupChatCreated.created_by.toString(),
            },
            index: candid.index,
            timestamp: candid.timestamp,
        };
    }
    if ("ParticipantsAdded" in candid.event) {
        return {
            event: {
                kind: "participants_added",
                userIds: candid.event.ParticipantsAdded.user_ids.map((p) => p.toString()),
                addedBy: candid.event.ParticipantsAdded.added_by.toString(),
            },
            index: candid.index,
            timestamp: candid.timestamp,
        };
    }
    // todo - we know there are other event types that we are not dealing with yet
    throw new Error(`Unexpected ApiEventWrapper type received: ${JSON.stringify(candid.event)}`);
}

function message(candid: ApiGroupMessage): GroupMessage {
    return {
        kind: "group_message",
        content: messageContent(candid.content),
        sender: candid.sender.toString(),
        repliesTo: optional(candid.replies_to, replyContext),
        messageId: candid.message_id,
        messageIndex: candid.message_index,
    };
}

export function apiMessageContent(domain: MessageContent): ApiMessageContent {
    switch (domain.kind) {
        case "text_content":
            return { Text: apiTextContent(domain) };

        case "media_content":
            return { Media: apiMediaContent(domain) };

        case "file_content":
            return { File: apiFileContent(domain) };

        case "cycles_content":
            return { Cycles: apiCyclesContent(domain) };
    }
}

function messageContent(candid: ApiMessageContent): MessageContent {
    if ("File" in candid) {
        return fileContent(candid.File);
    }
    if ("Text" in candid) {
        return textContent(candid.Text);
    }
    if ("Media" in candid) {
        return mediaContent(candid.Media);
    }
    if ("Cycles" in candid) {
        return cyclesContent(candid.Cycles);
    }
    throw new UnsupportedValueError("Unexpected ApiMessageContent type received", candid);
}

function apiMediaContent(domain: MediaContent): ApiMediaContent {
    return {
        height: domain.height,
        mime_type: domain.mimeType,
        blob_reference: apiBlobReference(domain.blobReference),
        thumbnail_data: domain.thumbnailData,
        caption: apiOptional(identity, domain.caption),
        width: domain.width,
    };
}

export function apiOptional<D, A>(mapper: (d: D) => A, domain: D | undefined): [] | [A] {
    return domain ? [mapper(domain)] : [];
}

function apiBlobReference(domain?: BlobReference): [] | [ApiBlobReference] {
    return apiOptional(
        (b) => ({
            blob_id: b.blobId,
            blob_size: b.blobSize,
            canister_id: Principal.fromText(b.canisterId),
            chunk_size: b.chunkSize,
        }),
        domain
    );
}

function mediaContent(candid: ApiMediaContent): MediaContent {
    return {
        kind: "media_content",
        height: candid.height,
        mimeType: candid.mime_type,
        blobReference: optional(candid.blob_reference, blobReference),
        blobData: Promise.resolve(undefined), // this will get filled in a bit later
        thumbnailData: candid.thumbnail_data,
        caption: optional(candid.caption, identity),
        width: candid.width,
    };
}

function cyclesContent(candid: ApiCyclesContent): CyclesContent {
    return {
        kind: "cycles_content",
        caption: optional(candid.caption, identity),
        amount: candid.amount,
    };
}

function apiCyclesContent(domain: CyclesContent): ApiCyclesContent {
    return {
        caption: apiOptional(identity, domain.caption),
        amount: domain.amount,
    };
}

function textContent(candid: ApiTextContent): TextContent {
    return {
        kind: "text_content",
        text: candid.text,
    };
}

function apiTextContent(domain: TextContent): ApiTextContent {
    return {
        text: domain.text,
    };
}

function fileContent(candid: ApiFileContent): FileContent {
    return {
        kind: "file_content",
        name: candid.name,
        mimeType: candid.mime_type,
        blobReference: optional(candid.blob_reference, blobReference),
        blobData: Promise.resolve(undefined), // this will get filled in a bit later
        caption: optional(candid.caption, identity),
    };
}

function apiFileContent(domain: FileContent): ApiFileContent {
    return {
        name: domain.name,
        mime_type: domain.mimeType,
        blob_reference: apiBlobReference(domain.blobReference),
        caption: apiOptional(identity, domain.caption),
    };
}

function blobReference(candid: ApiBlobReference): BlobReference {
    return {
        blobSize: candid.blob_size,
        blobId: candid.blob_id,
        canisterId: candid.canister_id.toString(),
        chunkSize: candid.chunk_size,
    };
}

function replyContext(candid: ApiGroupReplyContext): GroupChatReplyContext {
    return {
        kind: "group_reply_context",
        content: messageContent(candid.content),
        userId: candid.user_id.toString(),
        eventIndex: candid.event_index,
    };
}
