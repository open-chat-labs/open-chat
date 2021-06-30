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
} from "api-canisters/user/canister";
import type {
    BlobReference,
    ChatSummary,
    CyclesContent,
    FileContent,
    MediaContent,
    Message,
    MessageContent,
    ReplyContext,
    TextContent,
} from "../../domain/chat";
import { identity, optional } from "../../utils/mapping";

export function getChatsResponse(candid: ApiGetChatsResponse): ChatSummary[] {
    return candid.Success.chats.map(chatSummary);
}

function chatSummary(candid: ApiChatSummary): ChatSummary {
    return {
        them: candid.them,
        lastUpdated: candid.last_updated,
        displayDate: candid.display_date,
        unreadByThemMessageIdRanges: candid.unread_by_them_message_id_ranges,
        latestMessages: candid.latest_messages.map(message),
        unreadByMeMessageIdRanges: candid.unread_by_me_message_id_ranges,
    };
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
