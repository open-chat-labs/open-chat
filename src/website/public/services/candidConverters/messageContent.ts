import { MessageContent } from "../../model/messages";

export function fromCandid(payload: any) : MessageContent {
    if (payload.hasOwnProperty("Text")) {
        const inner = payload.Text;
        return {
            kind: "text",
            text: inner.text
        };
    }
    if (payload.hasOwnProperty("Media")) {
        const inner = payload.Media;
        return {
            kind: "media",
            caption: inner.caption,
            mimeType: inner.mime_type,
            blobId: inner.blob_id,
            blobSize: inner.blob_size,
            chunkSize: inner.chunk_size
        };
    }
    throw new Error("Unrecognised payload type - " + JSON.stringify(payload));
}

export function toCandid(content: MessageContent) : any {
    if (content.kind === "text") {
        return {
            Text: {
                text: content.text
            }
        };
    } else {
        return {
            Media: {
                caption: content.caption,
                mime_type: content.mimeType,
                blob_id: content.blobId,
                blob_size: content.blobSize,
                chunk_size: content.chunkSize
            }
        };
    }
}
