import type {
    ApiBlobReference,
    ApiChatSummary,
    ApiCyclesContent,
    ApiFileContent,
    ApiEventsResponse,
    ApiMediaContent,
    ApiMessageContent,
    ApiGroupReplyContext,
    ApiTextContent,
    ApiUpdatesResponse,
    ApiParticipant,
    ApiCreateGroupResponse,
    ApiChunkResponse,
    ApiChatSummaryUpdates,
    ApiGroupMessage,
    ApiDirectChatEventWrapper,
    ApiDirectReplyContext,
    ApiDirectMessage,
} from "./candid/idl";
import type {
    BlobReference,
    ChatSummary,
    CyclesContent,
    FileContent,
    UpdatesResponse,
    EventsResponse,
    EventWrapper,
    MediaContent,
    MessageContent,
    TextContent,
    Participant,
    ChatSummaryUpdates,
    CreateGroupResponse,
    DirectChatEvent,
    GroupMessage,
    DirectMessage,
    GroupChatReplyContext,
    DirectChatReplyContext,
} from "../../domain/chat/chat";
import { identity, optional } from "../../utils/mapping";
import type { ChunkResponse } from "../../domain/data/data";
import { UnsupportedValueError } from "../../utils/error";

export function chunkResponse(candid: ApiChunkResponse): ChunkResponse {
    if ("NotFound" in candid) {
        return undefined;
    }
    if ("Success" in candid) {
        return new Uint8Array(candid.Success.bytes);
    }

    throw new UnsupportedValueError("Unexpected ApiChunkResponse type received", candid);
}

export function createGroupResponse(candid: ApiCreateGroupResponse): CreateGroupResponse {
    if ("Success" in candid) {
        return { kind: "success", canisterId: candid.Success.group_chat_id.toString() };
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

    if ("DescriptionTooLong" in candid) {
        return { kind: "description_too_long" };
    }

    if ("Throttled" in candid) {
        return { kind: "throttled" };
    }

    if ("InternalError" in candid) {
        return { kind: "internal_error" };
    }

    if ("NotAuthorized" in candid) {
        return { kind: "not_authorized" }
    }

    throw new UnsupportedValueError("Unexpected ApiCreateGroupResponse type received", candid);
}

export function getEventsResponse(candid: ApiEventsResponse): EventsResponse<DirectChatEvent> {
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
    throw new UnsupportedValueError("Unexpected ApiEventsResponse type received", candid);
}

function event(candid: ApiDirectChatEventWrapper): EventWrapper<DirectChatEvent> {
    if ("Message" in candid.event) {
        return {
            event: directMessage(candid.event.Message),
            index: candid.index,
            timestamp: candid.timestamp,
        };
    }
    if ("DirectChatCreated" in candid.event) {
        return {
            event: {
                kind: "direct_chat_created",
            },
            index: candid.index,
            timestamp: candid.timestamp,
        };
    }
    throw new Error("Unexpected ApiDirectChatEventWrapper type received");
}

export function getUpdatesResponse(candid: ApiUpdatesResponse): UpdatesResponse {
    if ("Success" in candid) {
        return {
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
        return {
            kind: "group_chat",
            chatId: candid.Group.chat_id.toString(),
            lastUpdated: candid.Group.last_updated,
            latestReadByMe: optional(candid.Group.latest_read_by_me, identity),
            latestMessage: optional(candid.Group.latest_message, (ev) => ({
                index: ev.index,
                timestamp: ev.timestamp,
                event: groupMessage(ev.event),
            })),
            name: optional(candid.Group.name, identity),
            description: optional(candid.Group.description, identity),
            participantsAddedOrUpdated: candid.Group.participants_added_or_updated.map(participant),
            participantsRemoved: new Set(
                candid.Group.participants_removed.map((p) => p.toString())
            ),
            latestEventIndex: optional(candid.Group.latest_event_index, identity),
        };
    }
    if ("Direct" in candid) {
        return {
            kind: "direct_chat",
            chatId: candid.Direct.chat_id.toString(),
            latestReadByMe: optional(candid.Direct.latest_read_by_me, identity),
            latestMessage: optional(candid.Direct.latest_message, (ev) => ({
                index: ev.index,
                timestamp: ev.timestamp,
                event: directMessage(ev.event),
            })),
            latestReadByThem: optional(candid.Direct.latest_read_by_them, identity),
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
                    event: groupMessage(ev.event),
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
                event: directMessage(candid.Direct.latest_message.event),
            },
            them: candid.Direct.them.toString(),
            latestEventIndex: candid.Direct.latest_event_index,
            latestReadByMe: candid.Direct.latest_read_by_me,
            latestReadByThem: candid.Direct.latest_read_by_me,
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

function groupMessage(candid: ApiGroupMessage): GroupMessage {
    return {
        kind: "group_message",
        content: messageContent(candid.content),
        sender: candid.sender.toString(),
        repliesTo: optional(candid.replies_to, groupReplyContext),
        messageId: candid.message_id,
        messageIndex: candid.message_index,
    };
}

function directMessage(candid: ApiDirectMessage): DirectMessage {
    return {
        kind: "direct_message",
        content: messageContent(candid.content),
        sentByMe: candid.sent_by_me,
        repliesTo: optional(candid.replies_to, directReplyContext),
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
    throw new UnsupportedValueError("Unexpected ApiMessageContent type received", candid);
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

function groupReplyContext(candid: ApiGroupReplyContext): GroupChatReplyContext {
    return {
        kind: "group_reply_context",
        content: messageContent(candid.content),
        userId: candid.user_id.toString(),
        eventIndex: candid.event_index,
    };
}

function directReplyContext(candid: ApiDirectReplyContext): DirectChatReplyContext {
    if ("Private" in candid) {
        return {
            kind: "direct_private_reply_context",
            chatId: candid.Private.chat_id.toString(),
            eventIndex: candid.Private.event_index,
        };
    }

    if ("Standard" in candid) {
        return {
            kind: "direct_standard_reply_context",
            content: messageContent(candid.Standard.content),
            sentByMe: candid.Standard.sent_by_me,
            eventIndex: candid.Standard.event_index,
        };
    }

    throw new UnsupportedValueError("Unexpected ApiDirectReplyContext type received", candid);
}
