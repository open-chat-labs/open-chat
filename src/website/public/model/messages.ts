import { UserId } from "./users";
import { Option } from "./common";

export type Message = ConfirmedMessage | UnconfirmedMessage;
export type ConfirmedMessage = LocalMessage | RemoteMessage;
export type MessageContent = TextContent | MediaContent;
export type SendMessageContent = TextContent | SendMediaContent;

export type LocalMessage = {
    kind: "local",
    id: number,
    key: string,
    date: Date,
    sender: UserId,
    content: MessageContent
}

export type RemoteMessage = {
    kind: "remote",
    id: number
}

export type UnconfirmedMessage = {
    kind: "unconfirmed",
    key: string,
    content: MessageContent
}

export type TextContent = {
    kind: "text",
    text: string
}

export type MediaContent = {
    kind: "media",
    caption: Option<string>;
    mimeType: string,
    blobId: string,
    blobSize: number,
    chunkSize: number,
}

export type SendMediaContent = {
    kind: "media",
    caption: Option<string>,
    mimeType: string,
    blob: Uint8Array
}
