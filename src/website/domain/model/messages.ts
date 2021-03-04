import { ChatId } from "./chats";
import { Option } from "./common";
import { UserId } from "./users";

export type Message = ConfirmedMessage | UnconfirmedMessage | P2PMessage;
export type ConfirmedMessage = LocalMessage | RemoteMessage;
export type MessageContent = TextContent | MediaContent | FileContent | CyclesContent;
export type SendMessageContent = TextContent | SendMediaContent | SendFileContent | CyclesContent;

export type LocalMessage = {
    kind: "local",
    id: number,
    clientMessageId: string,
    date: Date,
    sender: UserId,
    content: MessageContent,
    repliesTo: Option<ReplyContext>
}

export type RemoteMessage = {
    kind: "remote",
    id: number
}

export type UnconfirmedMessage = {
    kind: "unconfirmed",
    clientMessageId: string,
    date: Date,
    content: MessageContent,
    repliesTo: Option<ReplyContext>
}

export type P2PMessage = {
    kind: "p2p",
    clientMessageId: string,
    date: Date,
    sender: UserId,
    content: MessageContent,
    repliesTo: Option<ReplyContext>
}

export type TextContent = {
    kind: "text",
    text: string
}

export type MediaContent = {
    kind: "media",
    id: string,
    size: number,
    caption: Option<string>,
    mimeType: string,
    width: number,
    height: number,
    chunkSize: number,
    data: Option<string>,
    thumbnailData: string
}

export type FileContent = {
    kind: "file",
    id: string,
    size: number,
    name: string;
    mimeType: string,
    chunkSize: number,
}

export type CyclesContent = {
    kind: "cycles",
    amount: bigint,
    caption: Option<string>
}

export type SendMediaContent = {
    kind: "media",
    caption: Option<string>,
    mimeType: string,
    width: number,
    height: number,
    data: Uint8Array,
    thumbnailData: string
}

export type SendFileContent = {
    kind: "file",
    name: string,
    mimeType: string,
    data: Uint8Array
}

export type ReplyContext = {
    chatId: ChatId,
    userId: UserId,
    messageId: number,
    content: MessageContent
}
