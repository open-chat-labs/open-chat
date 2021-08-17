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
    ApiCreateGroupResponse,
    ApiChunkResponse,
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
    CreateGroupResponse,
} from "../../domain/chat/chat";
import { identity, optional } from "../../utils/mapping";
import type { ChunkResponse } from "../../domain/data/data";

export function chunkResponse(candid: ApiChunkResponse): ChunkResponse {
    if ("NotFound" in candid) {
        return undefined;
    }
    if ("Success" in candid) {
        return new Uint8Array(candid.Success.bytes);
    }

    throw new Error(`Unexpected ApiChunkResponse type received: ${candid}`);
}

export function createGroupResponse(candid: ApiCreateGroupResponse): CreateGroupResponse {
    if ("Success" in candid) {
        return { kind: "success", canisterId: candid.Success.canister_id.toString() };
    }

    if ("PublicGroupAlreadyExists" in candid) {
        return { kind: "public_group_already_exists" };
    }

    if ("InvalidName" in candid) {
        return { kind: "invalid_name" };
    }

    if ("NameTooLong" in candid) {
        return { kind: "name_too_long" };
    }

    if ("GroupLimitExceeded" in candid) {
        return { kind: "group_limit_exceeded" };
    }

    if ("UnknownError" in candid) {
        return { kind: "unknown_error" };
    }

    throw new Error(`Unexpected ApiCreateGroupResponse type received: ${candid}`);
}

export function getEventsResponse(candid: ApiEventsResponse): EventsResponse {
    if ("Success" in candid) {
        return {
            events: candid.Success.events.map((ev) => ({
                index: ev.index,
                timestamp: ev.timestamp,
                event: message(ev.event.Message),
            })),
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
            latestMessage: optional(candid.Group.latest_message, (ev) => ({
                index: ev.index,
                timestamp: ev.timestamp,
                event: message(ev.event.Message),
            })),
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
            latestMessage: optional(candid.Direct.latest_message, (ev) => ({
                index: ev.index,
                timestamp: ev.timestamp,
                event: message(ev.event.Message),
            })),
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
            latestMessage: optional(candid.Group.latest_message, (ev) => {
                return {
                    index: ev.index,
                    timestamp: ev.timestamp,
                    event: message(ev.event as ApiMessage),
                };
            }),
            latestReadByMe: candid.Group.latest_read_by_me,
            name: candid.Group.name,
            description: candid.Group.description,
            participants,
            public: candid.Group.is_public,
            joined: candid.Group.joined,
            minVisibleMessageIndex: candid.Group.min_visible_message_index,
            latestEventIndex: candid.Group.latest_event_index,
            lastUpdated: candid.Group.last_updated,
        };
    }
    if ("Direct" in candid) {
        return {
            kind: "direct_chat",
            chatId: candid.Direct.chat_id.toString(),
            latestMessage: {
                index: candid.Direct.latest_message.index,
                timestamp: candid.Direct.latest_message.timestamp,
                event: message(candid.Direct.latest_message.event),
            },
            them: candid.Direct.them.toString(),
            latestEventIndex: candid.Direct.latest_event_index,
            latestReadByMe: candid.Direct.latest_read_by_me,
            latestReadByThem: candid.Direct.latest_read_by_me,
            dateCreated: candid.Direct.date_created,
            lastUpdated: candid.Direct.last_updated,
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
