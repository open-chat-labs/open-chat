import type {
    ApiBlobReference,
    ApiChatSummary,
    ApiCyclesContent,
    ApiFileContent,
    ApiGetChatsResponse,
    ApiMediaContent,
    ApiMessage,
    ApiMessageContent,
    ApiReplyContext,
    ApiTextContent,
} from "api-canisters/user/src/canister/app/idl";
import type {
    BlobReference,
    ChatSummary,
    CyclesContent,
    FileContent,
    GetChatsResponse,
    MediaContent,
    Message,
    MessageContent,
    ReplyContext,
    TextContent,
} from "../../domain/chat";
import { identity, optional } from "../../utils/mapping";

export function getChatsResponse(candid: ApiGetChatsResponse): GetChatsResponse {
    if ("Success" in candid) {
        return {
            chats: candid.Success.chats.map(chatSummary),
        };
    }
    throw new Error(`Unexpected GetChatsResponse type received: ${candid}`);
}

function chatSummary(candid: ApiChatSummary): ChatSummary {
    if ("Group" in candid) {
        return {
            kind: "group_chat",
            subject: candid.Group.subject,
            chatId: candid.Group.id,
            lastUpdated: candid.Group.last_updated,
            displayDate: candid.Group.display_date,
            lastReadByUs: candid.Group.last_read_by_us,
            lastReadByThem: candid.Group.last_read_by_them,
            lastestMessageId: candid.Group.latest_message_id,
            latestMessage: optional(candid.Group.latest_message, message),
        };
    }
    if ("Direct" in candid) {
        return {
            kind: "direct_chat",
            chatId: candid.Direct.id,
            them: candid.Direct.them,
            lastUpdated: candid.Direct.last_updated,
            displayDate: candid.Direct.display_date,
            lastReadByUs: candid.Direct.last_read_by_us,
            lastReadByThem: candid.Direct.last_read_by_them,
            lastestMessageId: candid.Direct.latest_message_id,
            latestMessage: optional(candid.Direct.latest_message, message),
        };
    }
    throw new Error(`Unexpected ChatSummary type received: ${candid}`);
}

function message(candid: ApiMessage): Message {
    return {
        id: candid.id,
        content: messageContent(candid.content),
        sender: candid.sender,
        timestamp: candid.timestamp,
        repliesTo: optional(candid.replies_to, replyContext),
        clientMessageId: candid.client_message_id,
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
    if ("Cycles" in candid) {
        return cyclesContent(candid.Cycles);
    }
    throw new Error(`Unexpected MessageContent received: ${candid}`);
}

function cyclesContent(candid: ApiCyclesContent): CyclesContent {
    return {
        kind: "cycles_content",
        caption: optional(candid.caption, identity),
        amount: candid.amount,
    };
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
        content: messageContent(candid.content),
        userId: candid.user_id,
        messageId: candid.message_id,
    };
}
