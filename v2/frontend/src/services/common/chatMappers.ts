import { Principal } from "@dfinity/principal";
import DRange from "drange";
import type { ApiPublicGroupSummary, ApiPublicSummaryResponse } from "../group/candid/idl";
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
    GroupChatSummary,
} from "../../domain/chat/chat";
import type { BlobReference } from "../../domain/data/data";
import type { User } from "../../domain/user/user";
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
    ApiMessageIndexRange,
    ApiUser,
    ApiICP,
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
        updatedBy: candid.updated_by.toString(),
        messageId: candid.message_id,
        eventIndex: candid.event_index,
    };
}

export function apiMessageIndexRanges(ranges: ApiMessageIndexRange[]): DRange {
    const drange = new DRange();
    ranges.forEach((r) => drange.add(r.from, r.to));
    return drange;
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

export function apiUser(domain: User): ApiUser {
    return {
        user_id: Principal.fromText(domain.userId),
        username: domain.username,
    };
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
            amountE8s: candid.Pending.amount.e8s,
            feeE8s: optional(candid.Pending.fee, (f) => f.e8s),
            memo: optional(candid.Pending.memo, identity),
        };
    }
    if ("Completed" in candid) {
        return {
            transferKind: "icp_transfer",
            kind: "completed_icp_transfer",
            recipient: candid.Completed.recipient.toString(),
            sender: candid.Completed.sender.toString(),
            amountE8s: candid.Completed.amount.e8s,
            feeE8s: candid.Completed.fee.e8s,
            memo: candid.Completed.memo,
            blockIndex: candid.Completed.block_index,
        };
    }
    if ("Failed" in candid) {
        return {
            transferKind: "icp_transfer",
            kind: "failed_icp_transfer",
            recipient: candid.Failed.recipient.toString(),
            amountE8s: candid.Failed.amount.e8s,
            feeE8s: candid.Failed.fee.e8s,
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
                amount: apiICP(domain.amountE8s),
                fee: apiOptional(apiICP, domain.feeE8s),
                memo: apiOptional(identity, domain.memo),
            },
        };
    }
    if (domain.kind === "completed_icp_transfer") {
        return {
            Completed: {
                recipient: Principal.fromText(domain.recipient),
                sender: Principal.fromText(domain.sender),
                amount: apiICP(domain.amountE8s),
                fee: apiICP(domain.feeE8s),
                memo: domain.memo,
                block_index: domain.blockIndex,
            },
        };
    }
    if (domain.kind === "failed_icp_transfer") {
        return {
            Failed: {
                recipient: Principal.fromText(domain.recipient),
                amount: apiICP(domain.amountE8s),
                fee: apiICP(domain.feeE8s),
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

function apiICP(amountE8s: bigint): ApiICP {
    return {
        e8s: amountE8s,
    };
}

export function publicGroupSummary(candid: ApiPublicGroupSummary): GroupChatSummary {
    return {
        kind: "group_chat",
        chatId: candid.chat_id.toString(),
        readByMe: new DRange(),
        latestEventIndex: candid.latest_event_index,
        latestMessage: optional(candid.latest_message, (ev) => ({
            index: ev.index,
            timestamp: ev.timestamp,
            event: message(ev.event),
        })),
        notificationsMuted: true,
        name: candid.name,
        description: candid.description,
        public: true,
        joined: BigInt(Date.now()),
        minVisibleEventIndex: 0,
        minVisibleMessageIndex: 0,
        lastUpdated: candid.last_updated,
        participantCount: candid.participant_count,
        myRole: "previewer",
        mentions: [],
        blobReference: optional(candid.avatar_id, (blobId) => ({
            blobId,
            canisterId: candid.chat_id.toString(),
        })),
    };
}

export function publicSummaryResponse(
    candid: ApiPublicSummaryResponse
): GroupChatSummary | undefined {
    if ("Success" in candid) {
        return publicGroupSummary(candid.Success.summary);
    }
}
