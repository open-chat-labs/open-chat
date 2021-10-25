import { Principal } from "@dfinity/principal";
import type {
    FileContent,
    ImageContent,
    AudioContent,
    VideoContent,
    MessageContent,
    DeletedContent,
    TextContent,
    Message,
    ReplyContext,
    Reaction,
    StaleMessage,
    CryptocurrencyContent,
    CryptocurrencyTransfer,
    ICPTransfer,
    CyclesTransfer,
} from "../../domain/chat/chat";
import type { BlobReference } from "../../domain/data/data";
import { UnsupportedValueError } from "../../utils/error";
import { identity, optional } from "../../utils/mapping";
import type {
    ApiBlobReference,
    ApiFileContent,
    ApiImageContent,
    ApiAudioContent,
    ApiVideoContent,
    ApiMessageContent,
    ApiMessage,
    ApiTextContent,
    ApiReplyContext,
    ApiUpdatedMessage,
    ApiDeletedContent,
    ApiCryptocurrencyContent,
    ApiCryptocurrencyTransfer,
    ApiICPTransfer,
    ApiCyclesTransfer,
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
        return deletedContent(candid.Deleted);
    }
    if ("Cryptocurrency" in candid) {
        return cryptoContent(candid.Cryptocurrency);
    }
    throw new UnsupportedValueError("Unexpected ApiMessageContent type received", candid);
}

function deletedContent(candid: ApiDeletedContent): DeletedContent {
    return {
        kind: "deleted_content",
        deletedBy: candid.deleted_by.toString(),
        timestamp: candid.timestamp,
    };
}

function cryptoContent(candid: ApiCryptocurrencyContent): CryptocurrencyContent {
    return {
        kind: "crypto_content",
        caption: optional(candid.caption, identity),
        transfer: cryptoTransfer(candid.transfer),
    };
}

function cryptoTransfer(candid: ApiCryptocurrencyTransfer): CryptocurrencyTransfer {
    if ("ICP" in candid) {
        return icpTransfer(candid.ICP);
    }
    if ("Cycles" in candid) {
        return cyclesTransfer(candid.Cycles);
    }
    throw new UnsupportedValueError("Unexpected ApiCryptocurrencyTransfer type received", candid);
}

function cyclesTransfer(candid: ApiCyclesTransfer): CyclesTransfer {
    if ("Pending" in candid) {
        return {
            transferKind: "cycles_transfer",
            kind: "pending_cycles_transfer",
            recipient: candid.Pending.recipient.toString(),
            cycles: candid.Pending.cycles,
        };
    }
    if ("Completed" in candid) {
        return {
            transferKind: "cycles_transfer",
            kind: "completed_cycles_transfer",
            recipient: candid.Completed.recipient.toString(),
            sender: candid.Completed.sender.toString(),
            cycles: candid.Completed.cycles,
        };
    }
    if ("Failed" in candid) {
        return {
            transferKind: "cycles_transfer",
            kind: "failed_cycles_transfer",
            recipient: candid.Failed.recipient.toString(),
            cycles: candid.Failed.cycles,
            errorMessage: candid.Failed.error_message,
        };
    }
    throw new UnsupportedValueError("Unexpected ApiCyclesTransfer type received", candid);
}

function icpTransfer(candid: ApiICPTransfer): ICPTransfer {
    if ("Pending" in candid) {
        return {
            transferKind: "icp_transfer",
            kind: "pending_icp_transfer",
            recipient: candid.Pending.recipient.toString(),
            amountE8s: candid.Pending.amount_e8s,
            feeE8s: optional(candid.Pending.fee_e8s, identity),
            memo: optional(candid.Pending.memo, identity),
        };
    }
    if ("Completed" in candid) {
        return {
            transferKind: "icp_transfer",
            kind: "completed_icp_transfer",
            recipient: candid.Completed.recipient.toString(),
            sender: candid.Completed.sender.toString(),
            amountE8s: candid.Completed.amount_e8s,
            feeE8s: candid.Completed.fee_e8s,
            memo: candid.Completed.memo,
            blockHeight: candid.Completed.block_height,
        };
    }
    if ("Failed" in candid) {
        return {
            transferKind: "icp_transfer",
            kind: "failed_icp_transfer",
            recipient: candid.Failed.recipient.toString(),
            amountE8s: candid.Failed.amount_e8s,
            feeE8s: candid.Failed.fee_e8s,
            memo: candid.Failed.memo,
            errorMessage: candid.Failed.error_message,
        };
    }
    throw new UnsupportedValueError("Unexpected ApiICPTransfer type received", candid);
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
        kind: "raw_reply_context",
        eventIndex: candid.event_index,
        chatIdIfOther: optional(candid.chat_id_if_other, (id) => id.toString()),
    };
}

function reactions(candid: [string, Principal[]][]): Reaction[] {
    return candid.map(([reaction, userIds]) => ({
        reaction,
        userIds: new Set(userIds.map((u) => u.toString())),
    }));
}

export function apiReplyContextArgs(
    domain: ReplyContext,
    replyingToChatId?: string
): ApiReplyContext {
    return {
        chat_id_if_other: apiOptional((chatId) => Principal.fromText(chatId), replyingToChatId),
        event_index: domain.eventIndex,
    };
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

        case "crypto_content":
            return { Cryptocurrency: apiCryptoContent(domain) };

        case "deleted_content":
            return { Deleted: apiDeletedContent(domain) };

        case "placeholder_content":
            throw new Error("Incorrectly attempting to send placeholder content to the server");
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

function apiDeletedContent(domain: DeletedContent): ApiDeletedContent {
    return {
        deleted_by: Principal.fromText(domain.deletedBy),
        timestamp: domain.timestamp,
    };
}

function apiCryptoContent(domain: CryptocurrencyContent): ApiCryptocurrencyContent {
    return {
        caption: apiOptional(identity, domain.caption),
        transfer: apiCryptoTransfer(domain.transfer),
    };
}

function apiCryptoTransfer(domain: CryptocurrencyTransfer): ApiCryptocurrencyTransfer {
    if (domain.transferKind === "cycles_transfer") {
        return {
            Cycles: apiCyclesTransfer(domain),
        };
    }
    if (domain.transferKind === "icp_transfer") {
        return {
            ICP: apiICPTransfer(domain),
        };
    }
    throw new UnsupportedValueError("Unexpected transfer kind", domain);
}

function apiCyclesTransfer(domain: CyclesTransfer): ApiCyclesTransfer {
    if (domain.kind === "pending_cycles_transfer") {
        return {
            Pending: {
                recipient: Principal.fromText(domain.recipient),
                cycles: domain.cycles,
            },
        };
    }
    if (domain.kind === "completed_cycles_transfer") {
        return {
            Completed: {
                recipient: Principal.fromText(domain.recipient),
                sender: Principal.fromText(domain.sender),
                cycles: domain.cycles,
            },
        };
    }
    if (domain.kind === "failed_cycles_transfer") {
        return {
            Failed: {
                recipient: Principal.fromText(domain.recipient),
                cycles: domain.cycles,
                error_message: domain.errorMessage,
            },
        };
    }
    throw new UnsupportedValueError("Unexpected cycles transfer kind", domain);
}

function apiICPTransfer(domain: ICPTransfer): ApiICPTransfer {
    if (domain.kind === "pending_icp_transfer") {
        return {
            Pending: {
                recipient: Principal.fromText(domain.recipient),
                amount_e8s: domain.amountE8s,
                fee_e8s: apiOptional(identity, domain.feeE8s),
                memo: apiOptional(identity, domain.memo),
            },
        };
    }
    if (domain.kind === "completed_icp_transfer") {
        return {
            Completed: {
                recipient: Principal.fromText(domain.recipient),
                sender: Principal.fromText(domain.sender),
                amount_e8s: domain.amountE8s,
                fee_e8s: domain.feeE8s,
                memo: domain.memo,
                block_height: domain.blockHeight,
            },
        };
    }
    if (domain.kind === "failed_icp_transfer") {
        return {
            Failed: {
                recipient: Principal.fromText(domain.recipient),
                amount_e8s: domain.amountE8s,
                fee_e8s: domain.feeE8s,
                memo: domain.memo,
                error_message: domain.errorMessage,
            },
        };
    }
    throw new UnsupportedValueError("Unexpected cycles transfer kind", domain);
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
