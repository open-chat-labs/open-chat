import { Principal } from "@dfinity/principal";
import type {
    CyclesContent,
    FileContent,
    ImageContent,
    AudioContent,
    VideoContent,
    MessageContent,
    TextContent,
    Message,
    ReplyContext,
    Reaction,
    StaleMessage,
} from "../../domain/chat/chat";
import type { BlobReference } from "../../domain/data/data";
import { UnsupportedValueError } from "../../utils/error";
import { identity, optional } from "../../utils/mapping";
import type {
    ApiBlobReference,
    ApiCyclesContent,
    ApiFileContent,
    ApiImageContent,
    ApiAudioContent,
    ApiVideoContent,
    ApiMessageContent,
    ApiMessage,
    ApiTextContent,
    ApiReplyContext,
    ApiUpdatedMessage,
    ApiReplyContextArgs,
} from "../user/candid/idl";

export function message(candid: ApiMessage): Message {
    return {
        kind: "message",
        content: messageContent(candid.content),
        sender: candid.sender.toString(),
        repliesTo: optional(candid.replies_to, replyContext),
        messageId: candid.message_id,
        messageIndex: candid.message_index,
        reactions: reactions(candid.reactions),
        edited: candid.edited,
    };
}

export function updatedMessage(candid: ApiUpdatedMessage): StaleMessage {
    return {
        messageId: candid.message_id,
        eventIndex: candid.event_index,
    };
}

export function messageContent(candid: ApiMessageContent): MessageContent {
    if ("File" in candid) {
        return fileContent(candid.File);
    }
    if ("Text" in candid) {
        return textContent(candid.Text);
    }
    if ("Image" in candid) {
        return imageContent(candid.Image);
    }
    if ("Video" in candid) {
        return videoContent(candid.Video);
    }
    if ("Audio" in candid) {
        return audioContent(candid.Audio);
    }
    if ("Deleted" in candid) {
        return { kind: "deleted_content" };
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

function imageContent(candid: ApiImageContent): ImageContent {
    return {
        kind: "image_content",
        height: candid.height,
        mimeType: candid.mime_type,
        blobReference: optional(candid.blob_reference, blobReference),
        thumbnailData: candid.thumbnail_data,
        caption: optional(candid.caption, identity),
        width: candid.width,
    };
}

function videoContent(candid: ApiVideoContent): VideoContent {
    return {
        kind: "video_content",
        height: candid.height,
        mimeType: candid.mime_type,
        videoData: {
            blobReference: optional(candid.video_blob_reference, blobReference),
        },
        imageData: {
            blobReference: optional(candid.image_blob_reference, blobReference),
        },
        thumbnailData: candid.thumbnail_data,
        caption: optional(candid.caption, identity),
        width: candid.width,
    };
}

function audioContent(candid: ApiAudioContent): AudioContent {
    return {
        kind: "audio_content",
        mimeType: candid.mime_type,
        blobReference: optional(candid.blob_reference, blobReference),
        caption: optional(candid.caption, identity),
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
        fileSize: candid.file_size,
    };
}

function blobReference(candid: ApiBlobReference): BlobReference {
    return {
        blobId: candid.blob_id,
        canisterId: candid.canister_id.toString(),
    };
}

function replyContext(candid: ApiReplyContext): ReplyContext {
    return {
        content: optional(candid.content, messageContent),
        chatId: candid.chat_id.toString(),
        senderId: candid.sender.toString(),
        eventIndex: candid.event_index,
        messageId: candid.message_id,
    };
}

function reactions(candid: [string, Principal[]][]): Reaction[] {
    return candid.map(([reaction, userIds]) => ({
        reaction,
        userIds: new Set(userIds.map((u) => u.toString())),
    }));
}

export function apiReplyContextArgs(
    privateReply: boolean,
    domain: ReplyContext
): ApiReplyContextArgs {
    if (privateReply !== undefined) {
        return {
            Private: {
                content: apiOptional((content) => apiMessageContent(content), domain.content),
                sender: Principal.fromText(domain.senderId),
                chat_id: Principal.fromText(domain.chatId),
                message_id: domain.messageId,
                event_index: domain.eventIndex,
            },
        };
    } else {
        return {
            Direct: {
                message_id: domain.messageId,
            },
        };
    }
}

export function apiMessageContent(domain: MessageContent): ApiMessageContent {
    switch (domain.kind) {
        case "text_content":
            return { Text: apiTextContent(domain) };

        case "image_content":
            return { Image: apiImageContent(domain) };

        case "video_content":
            return { Video: apiVideoContent(domain) };

        case "audio_content":
            return { Audio: apiAudioContent(domain) };

        case "file_content":
            return { File: apiFileContent(domain) };

        case "cycles_content":
            return { Cycles: apiCyclesContent(domain) };

        case "deleted_content":
            return { Deleted: null };
    }
}

function apiImageContent(domain: ImageContent): ApiImageContent {
    return {
        height: domain.height,
        mime_type: domain.mimeType,
        blob_reference: apiBlobReference(domain.blobReference),
        thumbnail_data: domain.thumbnailData,
        caption: apiOptional(identity, domain.caption),
        width: domain.width,
    };
}

function apiVideoContent(domain: VideoContent): ApiVideoContent {
    return {
        height: domain.height,
        mime_type: domain.mimeType,
        video_blob_reference: apiBlobReference(domain.videoData.blobReference),
        image_blob_reference: apiBlobReference(domain.imageData.blobReference),
        thumbnail_data: domain.thumbnailData,
        caption: apiOptional(identity, domain.caption),
        width: domain.width,
    };
}

function apiAudioContent(domain: AudioContent): ApiAudioContent {
    return {
        mime_type: domain.mimeType,
        blob_reference: apiBlobReference(domain.blobReference),
        caption: apiOptional(identity, domain.caption),
    };
}

export function apiOptional<D, A>(mapper: (d: D) => A, domain: D | undefined): [] | [A] {
    return domain ? [mapper(domain)] : [];
}

function apiBlobReference(domain?: BlobReference): [] | [ApiBlobReference] {
    return apiOptional(
        (b) => ({
            blob_id: b.blobId,
            canister_id: Principal.fromText(b.canisterId),
        }),
        domain
    );
}

function apiCyclesContent(domain: CyclesContent): ApiCyclesContent {
    return {
        caption: apiOptional(identity, domain.caption),
        amount: domain.amount,
    };
}
function apiTextContent(domain: TextContent): ApiTextContent {
    return {
        text: domain.text,
    };
}
function apiFileContent(domain: FileContent): ApiFileContent {
    return {
        name: domain.name,
        mime_type: domain.mimeType,
        blob_reference: apiBlobReference(domain.blobReference),
        caption: apiOptional(identity, domain.caption),
        file_size: domain.fileSize,
    };
}
