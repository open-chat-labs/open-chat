import { Timestamp } from "./common";
import { Message } from "./messages";
import { UserId } from "./users";

export type ChatId = number;

export type Chat = ConfirmedChat | NewDirectChat;

export type ConfirmedChat = DirectChat | GroupChat;

export type DirectChat = ConfirmedChatCommon & {
    kind: "direct",
    them: UserId
}

export type GroupChat = ConfirmedChatCommon & {
    kind: "group",
    subject: string,
    participants: UserId[]
}

export type NewDirectChat = {
    kind: "newDirect",
    them: UserId,
    messages: Message[]
}

type ConfirmedChatCommon = {
    chatId: ChatId,
    updatedDate: Timestamp,
    readUpTo: number,
    confirmedOnServerUpTo: number, // Everything up to this is either a ConfirmedMessage or MissingMessage, everything after is an UnconfirmedMessage
    messagesToDownload: number[],
    messagesDownloading: number[],
    messages: Message[]
}
