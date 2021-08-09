import type {
    ApiBlobReference,
    ApiChatSummary,
    ApiCyclesContent,
    ApiFileContent,
    ApiEventsResponse,
    ApiMediaContent,
    ApiMessage,
    ApiMessageContent,
    ApiReplyContext,
    ApiTextContent,
    ApiUpdatesResponse,
    ApiParticipant,
    ApiUpdatedChatSummary,
    ApiEventWrapper,
} from "./candid/idl";
import type {
    BlobReference,
    ChatSummary,
    CyclesContent,
    FileContent,
    UpdatesResponse,
    EventsResponse,
    MediaContent,
    Message,
    MessageContent,
    ReplyContext,
    TextContent,
    Participant,
    UpdatedChatSummary,
    EventWrapper,
} from "../../domain/chat/chat";
import { identity, optional } from "../../utils/mapping";

export function getEventsResponse(candid: ApiEventsResponse): EventsResponse {
    if ("Success" in candid) {
        return {
            events: candid.Success.events.map(eventMessage),
        };
    }
    if ("ChatNotFound" in candid) {
        return "chat_not_found";
    }
    if ("NotAuthorised" in candid) {
        return "not_authorised";
    }
    throw new Error(`Unexpected GetMessagesResponse type received: ${candid}`);
}

export function getUpdatesResponse(userId: string, candid: ApiUpdatesResponse): UpdatesResponse {
    if ("Success" in candid) {
        return {
            chatsUpdated: candid.Success.chats_updated.map(updatedChatSummary),
            chatsAdded: candid.Success.chats_added.map((c) => chatSummary(userId, c)),
            chatsRemoved: new Set(candid.Success.chats_removed.map((p) => p.toString())),
            timestamp: candid.Success.timestamp,
        };
    }
    throw new Error(`Unexpected GetChatsResponse type received: ${candid}`);
}

function updatedChatSummary(candid: ApiUpdatedChatSummary): UpdatedChatSummary {
    if ("Group" in candid) {
        return {
            kind: "group_chat",
            chatId: candid.Group.chat_id.toString(),
            lastUpdated: candid.Group.last_updated,
            latestReadByMe: optional(candid.Group.latest_read_by_me, identity),
            latestMessage: optional(candid.Group.latest_message, eventMessage),
            name: optional(candid.Group.name, identity),
            description: optional(candid.Group.description, identity),
            participantsAdded: candid.Group.participants_added.map(participant),
            participantsUpdated: candid.Group.participants_updated.map(participant),
            participantsRemoved: new Set(
                candid.Group.participants_removed.map((p) => p.toString())
            ),
            latestEventIndex: candid.Group.latest_event_index,
        };
    }
    if ("Direct" in candid) {
        return {
            kind: "direct_chat",
            chatId: candid.Direct.chat_id.toString(),
            lastUpdated: candid.Direct.last_updated,
            latestReadByMe: optional(candid.Direct.latest_read_by_me, identity),
            latestMessage: optional(candid.Direct.latest_message, eventMessage),
            latestReadByThem: optional(candid.Direct.latest_read_by_them, identity),
            latestEventIndex: candid.Direct.latest_event_index,
        };
    }
    throw new Error(`Unexpected ChatSummary type received: ${candid}`);
}

function chatSummary(userId: string, candid: ApiChatSummary): ChatSummary {
    if ("Group" in candid) {
        const participants = candid.Group.participants.map(participant);
        return {
            kind: "group_chat",
            chatId: candid.Group.chat_id.toString(),
            lastUpdated: candid.Group.last_updated,
            latestReadByMe: candid.Group.latest_read_by_me,
            latestMessage: optional(candid.Group.latest_message, eventMessage),
            name: candid.Group.name,
            description: candid.Group.description,
            participants,
            public: candid.Group.public,
            joined: candid.Group.joined,
            minVisibleMessageIndex: candid.Group.min_visible_message_index,
            latestEventIndex: candid.Group.latest_event_index,
        };
    }
    if ("Direct" in candid) {
        return {
            kind: "direct_chat",
            chatId: candid.Direct.chat_id.toString(),
            lastUpdated: candid.Direct.last_updated,
            latestReadByMe: candid.Direct.latest_read_by_me,
            latestMessage: eventMessage(candid.Direct.latest_message),
            them: candid.Direct.them.toString(),
            latestReadByThem: candid.Direct.latest_read_by_them,
            latestEventIndex: candid.Direct.latest_event_index,
        };
    }
    throw new Error(`Unexpected ChatSummary type received: ${candid}`);
}

function participant(candid: ApiParticipant): Participant {
    return {
        role: "Admin" in candid.role ? "admin" : "standard",
        userId: candid.user_id.toString(),
    };
}

function eventMessage(candid: ApiEventWrapper): EventWrapper {
    return {
        event: message(candid.event.Message),
        index: candid.index,
        timestamp: candid.timestamp,
    };
}

function message(candid: ApiMessage): Message {
    return {
        kind: "message",
        content: messageContent(candid.content),
        sender: candid.sender.toString(),
        repliesTo: optional(candid.replies_to, replyContext),
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
