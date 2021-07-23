import type {
    ApiBlobReference,
    ApiFileContent,
    ApiGetMessagesResponse,
    ApiMediaContent,
    ApiMessage,
    ApiMessageContent,
    ApiReplyContext,
    ApiTextContent,
} from "api-canisters/group/src/canister/app/idl";
import type {
    BlobReference,
    FileContent,
    MessagesResponse,
    MediaContent,
    Message,
    MessageContent,
    ReplyContext,
    TextContent,
} from "../../domain/chat/chat";
import { identity, optional } from "../../utils/mapping";

// todo - these message data types look very similar to the direct chat counterparts but they are logically separate and in
// some aspects actually different so we will map them independently for the time being
// this means that we may not be able to just have a /domain/chat module - it might not be that simple

export function getMessagesResponse(candid: ApiGetMessagesResponse): MessagesResponse {
    if ("Success" in candid) {
        return {
            messages: candid.Success.messages.map(message),
            latestMessageIndex: candid.Success.latest_message_index,
        };
    }
    if ("ChatNotFound" in candid) {
        return "chat_not_found";
    }
    throw new Error(`Unexpected GetMessagesResponse type received: ${candid}`);
}

function message(candid: ApiMessage): Message {
    return {
        messageId: candid.message_id,
        content: messageContent(candid.content),
        sender: candid.sender.toString(),
        timestamp: candid.timestamp,
        repliesTo: optional(candid.replies_to, replyContext),
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
        caption: optional(candid.caption, identity),
    };
}

function blobReference(candid: ApiBlobReference): BlobReference {
    return {
        blobSize: candid.blob_size,
        blobId: candid.blob_id,
        canisterId: candid.canister_id,
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
