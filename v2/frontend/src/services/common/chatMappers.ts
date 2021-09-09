import { Principal } from "@dfinity/principal";
import type {
    BlobReference,
    CyclesContent,
    FileContent,
    MediaContent,
    MessageContent,
    TextContent,
} from "../../domain/chat/chat";
import { identity } from "../../utils/mapping";
import type {
    ApiBlobReference,
    ApiCyclesContent,
    ApiFileContent,
    ApiMediaContent,
    ApiMessageContent,
    ApiTextContent,
} from "../user/candid/idl";

export function apiMessageContent(domain: MessageContent): ApiMessageContent {
    switch (domain.kind) {
        case "text_content":
            return { Text: apiTextContent(domain) };

        case "media_content":
            return { Media: apiMediaContent(domain) };

        case "file_content":
            return { File: apiFileContent(domain) };

        case "cycles_content":
            return { Cycles: apiCyclesContent(domain) };
    }
}
function apiMediaContent(domain: MediaContent): ApiMediaContent {
    return {
        height: domain.height,
        mime_type: domain.mimeType,
        blob_reference: apiBlobReference(domain.blobReference),
        thumbnail_data: domain.thumbnailData,
        caption: apiOptional(identity, domain.caption),
        width: domain.width,
    };
}
export function apiOptional<D, A>(mapper: (d: D) => A, domain: D | undefined): [] | [A] {
    return domain ? [mapper(domain)] : [];
}

function apiBlobReference(domain?: BlobReference): [] | [ApiBlobReference] {
    return apiOptional(
        (b) => ({
            blob_id: b.blobId,
            blob_size: b.blobSize,
            canister_id: Principal.fromText(b.canisterId),
            chunk_size: b.chunkSize,
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
    };
}
