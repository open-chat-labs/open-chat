import type {
    ApiBlobReference,
    ApiChatSummary,
    ApiCyclesContent,
    ApiFileContent,
    ApiGetChatsResponse,
    ApiGetMessagesResponse,
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
    GetMessagesResponse,
    MediaContent,
    Message,
    MessageContent,
    ReplyContext,
    TextContent,
} from "../../domain/chat/chat";
import { identity, optional } from "../../utils/mapping";

export function getMessagesResponse(candid: ApiGetMessagesResponse): GetMessagesResponse {
    if ("Success" in candid) {
        return {
            messages: candid.Success.messages.map(message),
            lastestMessageIndex: candid.Success.latest_message_index,
        };
    }
    if ("ChatNotFound" in candid) {
        return "chat_not_found";
    }
    throw new Error(`Unexpected GetMessagesResponse type received: ${candid}`);
}

export function getChatsResponse(candid: ApiGetChatsResponse): GetChatsResponse {
    if ("Success" in candid) {
        return {
            chats: candid.Success.chats.map(chatSummary),
            timestamp: candid.Success.timestamp,
        };
    }
    throw new Error(`Unexpected GetChatsResponse type received: ${candid}`);
}

function chatSummary(candid: ApiChatSummary): ChatSummary {
    if ("Group" in candid) {
        return {
            kind: "group_chat",
            subject: candid.Group.subject,
            chatId: candid.Group.id.toString(),
            lastUpdated: candid.Group.last_updated,
            displayDate: candid.Group.display_date,
            lastReadByUs: candid.Group.last_read_by_us,
            lastReadByThem: candid.Group.last_read_by_them,
            latestMessageIndex: candid.Group.latest_message_index,
            latestMessage: optional(candid.Group.latest_message, message),
            participants: candid.Group.participants.map((p) => p.toString()),
        };
    }
    if ("Direct" in candid) {
        return {
            kind: "direct_chat",
            chatId: candid.Direct.id.toString(),
            them: candid.Direct.them.toString(),
            lastUpdated: candid.Direct.last_updated,
            displayDate: candid.Direct.display_date,
            lastReadByUs: candid.Direct.last_read_by_us,
            lastReadByThem: candid.Direct.last_read_by_them,
            latestMessageIndex: candid.Direct.latest_message_index,
            latestMessage: optional(candid.Direct.latest_message, message),
        };
    }
    throw new Error(`Unexpected ChatSummary type received: ${candid}`);
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
    if ("Private" in candid) {
        return {
            kind: "direct_private_reply_context",
            chatId: candid.Private.chat_id.toString(),
            messageIndex: candid.Private.message_index,
        };
    }

    if ("Standard" in candid) {
        return {
            kind: "direct_standard_reply_context",
            content: messageContent(candid.Standard.content),
            sentByMe: candid.Standard.sent_by_me,
            messageIndex: candid.Standard.message_index,
        };
    }

    throw new Error(`Unexpected ReplyContext received: ${candid}`);
}
