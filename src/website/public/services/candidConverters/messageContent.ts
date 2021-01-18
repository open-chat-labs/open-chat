import { MessageContent } from "../../model/messages";

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
            caption: inner.caption,
            mimeType: inner.mime_type,
            blobId: inner.blob_id,
            blobSize: inner.blob_size,
            chunkSize: inner.chunk_size
        };
    }
    throw new Error("Unrecognised content type - " + JSON.stringify(content));
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
