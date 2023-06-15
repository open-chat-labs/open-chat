import type { Message, MessageContent, MessageFormatter } from "openchat-client";
import { buildCryptoTransferText, buildTransactionUrl } from "openchat-client";
import { toastStore } from "../stores/toast";
import { get } from "svelte/store";
import { _ } from "svelte-i18n";

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

export function copyMessageUrl(
    chatId: string,
    messageIndex: number,
    threadRootMessageIndex?: number
): void {
    const url = buildMessageUrl(chatId, messageIndex, threadRootMessageIndex);

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

export function canShare(): boolean {
    return navigator.share !== undefined;
}

export function canShareMessage(content: MessageContent): boolean {
    if (!canShare()) {
        return false;
    }

    if (content.kind === "placeholder_content" || content.kind === "deleted_content") {
        return false;
    }

    if (content.kind === "crypto_content" && content.transfer.kind === "failed") {
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
        return permittedMimeTypes[content.mimeType] !== undefined;
    }

    return true;
}

export function shareMessage(
    formatter: MessageFormatter,
    userId: string,
    me: boolean,
    msg: Message
): void {
    buildShareFromMessage(formatter, userId, me, msg).then(
        (share) =>
            navigator.share(share).catch((e: DOMException) => {
                if (e.name !== "AbortError") {
                    const errorMessage = "Failed to share message";
                    console.log(`${errorMessage}: ${e}`);
                    toastStore.showFailureToast("failedToShareMessage");
                }
            }),
        () => toastStore.showFailureToast("failedToShareMessage")
    );
}

export function shareLink(url: string): void {
    const share = {
        url,
        files: [],
    };
    navigator.share(share).catch((e: DOMException) => {
        if (e.name !== "AbortError") {
            const errorMessage = `Failed to share link ${url}`;
            console.log(`${errorMessage}: ${e}`);
            toastStore.showFailureToast("failedToShareLink");
        }
    });
}

async function buildShareFromMessage(
    formatter: MessageFormatter,
    userId: string,
    me: boolean,
    msg: Message
): Promise<Share> {
    const content = msg.content;
    if (content.kind === "deleted_content" || content.kind === "placeholder_content") {
        return Promise.reject();
    }

    const share: Share = {
        title: undefined,
        text: "",
        url: undefined,
        files: [],
    };

    if (content.kind === "text_content") {
        share.text = content.text;
    } else if (
        content.kind === "file_content" ||
        content.kind === "image_content" ||
        content.kind === "video_content" ||
        content.kind === "audio_content" ||
        content.kind === "giphy_content"
    ) {
        share.text = content.caption ?? "";

        const blobUrl = extractBlobUrl(msg.content);
        if (blobUrl === undefined) {
            const error = "No blob url found";
            console.log(error);
            return Promise.reject();
        }

        const mimeType =
            content.kind === "giphy_content" ? content.desktop.mimeType : content.mimeType;

        // We need to give the file a valid filename (incl extension) otherwise the call to navigator.share
        // will fail with "DOMException permission denied"
        const filename =
            content.kind === "file_content"
                ? content.name
                : buildDummyFilename(
                      mimeType,
                      content.kind === "giphy_content" ? content.title : undefined
                  );

        let file: File;
        try {
            file = await fetchBlob(blobUrl, mimeType, filename);
        } catch (e) {
            const errorMessage = "Failed to fetch blob";
            console.log(`${errorMessage}: ${e}`);
            return Promise.reject();
        }

        if (content.kind === "file_content") {
            share.title = file.name;
        }

        share.files = [file];
    } else if (content.kind === "poll_content") {
        // TODO:
        share.text = "TODO: Poll content";
    } else if (content.kind === "crypto_content") {
        let text = buildCryptoTransferText(formatter, userId, msg.sender, content, me);
        if (content.caption !== undefined) {
            if (text !== undefined) {
                text += "\n\n";
            }
            text += content.caption;
        }

        const transactionUrl = buildTransactionUrl(content.transfer);
        if (transactionUrl !== undefined) {
            if (text !== undefined) {
                text += "\n\n";
            }
            text += transactionUrl;
        }
        share.text = text ?? get(_)("tokenTransfer.unexpected");
    }

    return share;
}

function extractBlobUrl(content: MessageContent): string | undefined {
    switch (content.kind) {
        case "video_content":
            return content.videoData.blobUrl;
        case "file_content":
        case "image_content":
        case "audio_content":
            return content.blobUrl;
        case "giphy_content":
            return content.desktop.url;
        default:
            return;
    }
}

async function fetchBlob(blobUrl: string, mimeType: string, filename: string): Promise<File> {
    const response = await fetch(blobUrl, {
        headers: {
            Accept: mimeType,
        },
    });
    const data = await response.blob();
    return new File([data], filename, { type: mimeType });
}

function buildDummyFilename(mimeType: string, title?: string): string {
    const name = title !== undefined ? title.replace(/\s+/g, "_") : mimeType.split("/")[0];

    const ext = permittedMimeTypes[mimeType];
    const filename = `${name}.${ext}`;
    return filename;
}

export function buildMessageUrl(
    chatId: string,
    messageIndex: number,
    threadRootMessageIndex?: number
): string {
    const chatUrl = `${window.location.origin}/${chatId}/`;
    return threadRootMessageIndex === undefined
        ? `${chatUrl}${messageIndex}`
        : `${chatUrl}${threadRootMessageIndex}/${messageIndex}`;
}
