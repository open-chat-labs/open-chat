import type { Message, MessageContent } from "./chat/chat";
import { toastStore } from "../stores/toast";
import { get } from "svelte/store";
import { _ } from "svelte-i18n";
import { buildCryptoTransferText, buildTransactionUrl } from "./chat/chat.utils";
import { rollbar } from "../utils/logging";

export type Share = {
    title: string | undefined;
    text: string | undefined;
    url: string | undefined;
    files: File[];
};

const permittedMimeTypes: Record<string, string> = {
    "application/pdf": "pdf",
    "audio/flac": "flac",
    "audio/x-m4a": "m4a",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
    "audio/webm": "weba",
    "image/bmp": "bmp",
    "image/gif": "gif",
    "image/x-icon": "ico",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/svg+xml": "svg",
    "image/tiff": "tif",
    "image/webp": "webp",
    "image/x-xbitmap": "xbm",
    "text/css": "css",
    "text/csv": "csv",
    "text/html": "html",
    "text/plain": "txt",
    "video/mp4": "mp4",
    "video/mpeg": "mpeg",
    "video/ogg": "ogv",
    "video/webm": "webm",
};

export function copyMessageUrl(chatId: string, messageIndex: number): void {
    const url = buildMessageUrl(chatId, messageIndex);

    navigator.clipboard.writeText(url).then(
        () => {
            toastStore.showSuccessToast("messageUrlCopiedToClipboard");
        },
        () => {
            toastStore.showFailureToast("failedToCopyUrlToClipboard", {
                values: { url },
            });
        }
    );
}

export function canShare(content: MessageContent): boolean {
    if (navigator.share === undefined) {
        return false;
    }

    if (content.kind === "placeholder_content" || content.kind === "deleted_content") {
        return false;
    }

    if (content.kind === "crypto_content" && content.transfer.kind === "failed_icp_transfer") {
        return false;
    }

    // This is tempoaray until we implement a text only version of a poll message
    if (content.kind === "poll_content") {
        return false;
    }

    if (
        content.kind === "file_content" ||
        content.kind === "image_content" ||
        content.kind === "video_content" ||
        content.kind === "audio_content"
    ) {
        return (
            navigator.canShare !== undefined && permittedMimeTypes[content.mimeType] !== undefined
        );
    }

    return true;
}

export function shareMessage(userId: string, me: boolean, msg: Message): void {
    buildShareFromMessage(userId, me, msg).then(
        (share) =>
            navigator.share(share).catch((e: DOMException) => {
                if (e.name !== "AbortError") {
                    const errorMessage = "Failed to share message";
                    console.log(`${errorMessage}: ${e}`);
                    rollbar.error(errorMessage, e);
                    toastStore.showFailureToast("failedToShareMessage");
                }
            }),
        () => toastStore.showFailureToast("failedToShareMessage")
    );
}

async function buildShareFromMessage(userId: string, me: boolean, msg: Message): Promise<Share> {
    const kind = msg.content.kind;
    if (kind === "deleted_content" || kind === "placeholder_content") {
        return Promise.reject();
    }

    const share: Share = {
        title: undefined,
        text: "",
        url: undefined,
        files: [],
    };

    if (
        kind === "file_content" ||
        kind === "image_content" ||
        kind === "video_content" ||
        kind === "audio_content"
    ) {
        share.text = msg.content.caption ?? "";

        const blobUrl = extractBlobUrl(msg.content);
        if (blobUrl === undefined) {
            const error = "No blob url found";
            console.log(error);
            rollbar.error(error);
            return Promise.reject();
        }

        // We need to give the file a valid filename (incl extension) otherwise the call to navigator.share
        // will fail with "DOMException permission denied"
        const filename =
            msg.content.kind === "file_content"
                ? msg.content.name
                : buildDummyFilename(msg.content.mimeType);

        let file: File;
        try {
            file = await fetchBlob(blobUrl, msg.content.mimeType, filename);
        } catch (e) {
            const errorMessage = "Failed to fetch blob";
            console.log(`${errorMessage}: ${e}`);
            rollbar.error(errorMessage, e as Error);
            return Promise.reject();
        }

        if (kind === "file_content") {
            share.title = file.name;
        }

        share.files = [file];
    } else if (kind === "text_content") {
        share.text = msg.content.text;
    } else if (kind === "poll_content") {
        // TODO:
        share.text = "TODO: Poll content";
    } else if (kind === "crypto_content") {
        let text = buildCryptoTransferText(userId, msg.sender, msg.content, me);
        if (msg.content.caption !== undefined) {
            if (text !== undefined) {
                text += "\n\n";
            }
            text += msg.content.caption;
        }

        const transactionUrl = buildTransactionUrl(msg.content);
        if (transactionUrl !== undefined) {
            if (text !== undefined) {
                text += "\n\n";
            }
            text += transactionUrl;
        }
        share.text = text ?? get(_)("icpTransfer.unexpected");
    }

    return share;
}

function extractBlobUrl(content: MessageContent): string | undefined {
    let blobUrl: string | undefined;

    switch (content.kind) {
        case "video_content":
            blobUrl = content.videoData.blobUrl;
            break;
        case "file_content":
        case "image_content":
        case "audio_content":
            blobUrl = content.blobUrl;
            break;
        default:
            return;
    }

    return blobUrl;
}

function fetchBlob(blobUrl: string, mimeType: string, filename: string): Promise<File> {
    return fetch(blobUrl)
        .then((response) => response.blob())
        .then((data) => new File([data], filename, { type: mimeType }));
}

function buildDummyFilename(mimeType: string): string {
    const name = mimeType.split("/")[0];
    const ext = permittedMimeTypes[mimeType];
    const filename = `${name}.${ext}`;
    return filename;
}

function buildMessageUrl(chatId: string, messageIndex: number): string {
    return `${window.location.origin}/#/${chatId}/${messageIndex}`;
}
