import type {
    ApiBlobReference,
    ApiEventsResponse,
    ApiEventWrapper,
    ApiFileContent,
    ApiMediaContent,
    ApiMessage,
    ApiMessageContent,
    ApiReplyContext,
    ApiTextContent,
} from "./candid/idl";
import type {
    BlobReference,
    FileContent,
    EventsResponse,
    MediaContent,
    Message,
    MessageContent,
    ReplyContext,
    TextContent,
    EventWrapper,
} from "../../domain/chat/chat";
import { identity, optional } from "../../utils/mapping";

// todo - these message data types look very similar to the direct chat counterparts but they are logically separate and in
// some aspects actually different so we will map them independently for the time being
// this means that we may not be able to just have a /domain/chat module - it might not be that simple

export function getMessagesResponse(candid: ApiEventsResponse): EventsResponse {
    if ("Success" in candid) {
        return {
            events: candid.Success.events.map(event),
        };
    }
    if ("ChatNotFound" in candid) {
        return "chat_not_found";
    }
    if ("NotAuthorised" in candid) {
        return "not_authorised";
    }
    throw new Error(`Unexpected ApiEventsResponse type received: ${candid}`);
}

function event(candid: ApiEventWrapper): EventWrapper {
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
                description: optional(candid.event.GroupChatCreated.description, identity),
                created_by: candid.event.GroupChatCreated.created_by.toString(),
            },
            index: candid.index,
            timestamp: candid.timestamp,
        };
    }
    throw new Error(`Unexpected ApiEventWrapper type received: ${candid}`);
}

function message(candid: ApiMessage): Message {
    return {
        kind: "message",
        content: messageContent(candid.content),
        sender: candid.sender.toString(),
        repliesTo: optional(candid.replies_to, replyContext),
        messageId: candid.message_id,
        messageIndex: candid.message_index,
    };
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
    throw new Error(`Unexpected MessageContent received: ${candid}`);
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

function textContent(candid: ApiTextContent): TextContent {
    return {
        kind: "text_content",
        text: candid.text,
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

function blobReference(candid: ApiBlobReference): BlobReference {
    return {
        blobSize: candid.blob_size,
        blobId: candid.blob_id,
        canisterId: candid.canister_id.toString(),
        chunkSize: candid.chunk_size,
    };
}

function replyContext(candid: ApiReplyContext): ReplyContext {
    return {
        kind: "group_reply_context",
        content: messageContent(candid.content),
        userId: candid.user_id.toString(),
        messageId: candid.message_id,
        messageIndex: candid.message_index,
    };
}
