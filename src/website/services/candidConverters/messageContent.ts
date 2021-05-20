import { MessageContent } from "../../domain/model/messages";
import { fromCandid as optionFromCandid, toCandid as optionToCandid } from "./option";

export function fromCandid(content: any) : MessageContent {
    if (content.hasOwnProperty("Text")) {
        const inner = content.Text;
        return {
            kind: "text",
            text: inner.text
        };
    }
    if (content.hasOwnProperty("Media")) {
        const inner = content.Media;
        return {
            kind: "media",
            caption: optionFromCandid(inner.caption),
            mimeType: inner.mime_type,
            width: inner.width,
            height: inner.height,
            id: inner.blob_id,
            size: inner.blob_size,
            chunkSize: inner.chunk_size,
            thumbnailData: inner.thumbnail_data,
            blobUrl: null,
            blobDeleted: inner.blob_deleted
        };
    }
    if (content.hasOwnProperty("File")) {
        const inner = content.File;
        return {
            kind: "file",
            caption: optionFromCandid(inner.caption),
            name: inner.name,
            mimeType: inner.mime_type,
            id: inner.blob_id,
            size: inner.blob_size,
            chunkSize: inner.chunk_size,
            blobDeleted: inner.blob_deleted
        };
    }
    if (content.hasOwnProperty("Cycles")) {
        const inner = content.Cycles;
        return {
            kind: "cycles",
            caption: optionFromCandid(inner.caption),
            amount: BigInt(inner.amount)
        };
    }
    throw new Error("Unrecognised content type - " + JSON.stringify(content));
}

export function toCandid(content: MessageContent) : any {

    switch (content.kind) {
        case "text":
            return {
                Text: {
                    text: content.text
                }
            };
        case "media":
            return {
                Media: {
                    caption: optionToCandid(content.caption),
                    mime_type: content.mimeType,
                    width: content.width,
                    height: content.height,
                    blob_id: content.id,
                    blob_size: content.size,
                    chunk_size: content.chunkSize,
                    thumbnail_data: content.thumbnailData,
                    blob_deleted: content.blobDeleted
                }
            };
        case "file":
            return {
                File: {
                    caption: optionToCandid(content.caption),
                    name: content.name,
                    mime_type: content.mimeType,
                    blob_id: content.id,
                    blob_size: content.size,
                    chunk_size: content.chunkSize,
                    blob_deleted: content.blobDeleted
                }
            };
        case "cycles":
            return {
                Cycles: {
                    amount: content.amount,
                    caption: optionToCandid(content.caption)
                }
            };
    }
}
