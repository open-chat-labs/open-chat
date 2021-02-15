import { CyclesContent, MediaContent, MessageContent } from "../domain/model/messages";
import { formatCycles } from "../formatters/cycles";

export function getContentAsText(content: MessageContent) : string {
    if (content.kind === "text") {
        return content.text;
    } else if (content.kind === "media") {
        return buildTextForMediaContent(content);
    } else if (content.kind === "file") {
        return content.name;
    } else if (content.kind === "cycles") {
        return buildTextForCyclesContent(content);
    } else {
        throw new Error("Unrecognised content type - " + (content as any).kind);
    }
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

function buildTextForCyclesContent(content: CyclesContent) : string {
    if (content.caption)
        return content.caption;

    return formatCycles(content.amount);
}