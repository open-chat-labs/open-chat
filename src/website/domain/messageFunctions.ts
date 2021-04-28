import { MediaContent, MessageContent } from "./model/messages";
import { formatCycles } from "../formatters/cycles";

export function getContentAsText(content: MessageContent) : string {
    let text;
    if (content.kind === "text") {
        text = content.text;
    } else if (content.kind === "media") {
        text = buildTextForMediaContent(content);
    } else if (content.kind === "file") {
        text = content.name;
    } else if (content.kind === "cycles") {
        text = formatCycles(content.amount);
    } else {
        throw new Error("Unrecognised content type - " + (content as any).kind);
    }
    return text.trim();
}

function buildTextForMediaContent(content: MediaContent) : string {
    if (content.caption)
        return content.caption;

    const mimeType = content.mimeType;

    const mimeTypeLower = mimeType.toLowerCase();
    if (mimeTypeLower.startsWith("video/")) {
        return "video";
    } else if (mimeTypeLower.startsWith("image/")) {
        return "image";
    } else {
        return "file";
    }
}