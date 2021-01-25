import { UserId } from "./users";
import { Option } from "./common";

export type Message = ConfirmedMessage | UnconfirmedMessage;
export type ConfirmedMessage = LocalMessage | RemoteMessage;
export type MessageContent = TextContent | MediaContent | FileContent;
export type SendMessageContent = TextContent | SendMediaContent | SendFileContent;

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
    date: Date,
    content: MessageContent
}

export type TextContent = {
    kind: "text",
    text: string
}

export type MediaContent = {
    kind: "media",
    id: string,
    size: number,
    caption: Option<string>;
    mimeType: string,
    chunkSize: number,
}

export type FileContent = {
    kind: "file",
    id: string,
    size: number,
    name: string;
    mimeType: string,
    chunkSize: number,
}

export type SendMediaContent = {
    kind: "media",
    caption: Option<string>,
    mimeType: string,
    data: Uint8Array
}

export type SendFileContent = {
    kind: "file",
    name: string,
    mimeType: string,
    data: Uint8Array
}

