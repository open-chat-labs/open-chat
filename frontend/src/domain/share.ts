import type { Message, MessageContent } from "./chat/chat";
import { toastStore } from "../stores/toast";
import { get } from "svelte/store";
import { _ } from "svelte-i18n";
import { buildCryptoTransferText, buildTransactionLink } from "./chat/chat.utils";
import type { DataContent } from "./data/data";

export type Share = {
    title: string;
    text: string;
    url: string;
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

export async function shareMessage(
    chatId: string,
    userId: string,
    me: boolean,
    msg: Message
): Promise<void> {
    const share = await buildShareFromMessage(chatId, userId, me, msg);

    navigator.share(share).catch((e: DOMException) => {
        if (e.name !== "AbortError") {
            toastStore.showFailureToast("failedToShareMessage");
        }
    });
}

async function buildShareFromMessage(
    chatId: string,
    userId: string,
    me: boolean,
    msg: Message
): Promise<Share> {
    const kind = msg.content.kind;
    if (kind === "deleted_content" || kind === "placeholder_content") {
        return Promise.reject();
    }

    const share: Share = {
        title: "",
        text: "",
        url: buildMessageUrl(chatId, msg.messageIndex),
        files: [],
    };

    if (
        kind === "file_content" ||
        kind === "image_content" ||
        kind === "video_content" ||
        kind === "audio_content"
    ) {
        share.text = msg.content.caption ?? "";

        let file: File;
        try {
            file = await fetchBlob(msg.content);
        } catch {
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

        const transactionLink = buildTransactionLink(msg.content);
        if (transactionLink !== undefined) {
            if (text !== undefined) {
                text += "\n\n";
            }
            text += transactionLink;
        }
        share.text = text ?? get(_)("icpTransfer.unexpected");
    }

    return share;
}

async function fetchBlob(content: MessageContent): Promise<File> {
    let dataContent: DataContent;

    switch (content.kind) {
        case "video_content":
            dataContent = content.videoData;
            break;
        case "file_content":
        case "image_content":
        case "audio_content":
            dataContent = content;
            break;
        default:
            return Promise.reject();
    }

    if (dataContent.blobUrl === undefined) {
        return Promise.reject();
    }

    // We need to give the file a valid filename (and extension) otherwise the call to navigator.share
    // will fail with "DOMException permission denied"
    const filename =
        content.kind === "file_content" ? content.name : buildDummyFilename(content.mimeType);

    const r = await fetch(dataContent.blobUrl);
    const blobFile = await r.blob();
    return new File([blobFile], filename, { type: content.mimeType });
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
