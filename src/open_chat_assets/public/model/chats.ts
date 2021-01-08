import { Timestamp } from "./common";
import { ConfirmedMessage, UnconfirmedMessage } from "./messages";
import { UserId } from "./users";

export type ChatId = BigInt;

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
    updatedDate: Timestamp,
    unconfirmedMessages: UnconfirmedMessage[]
}

type ConfirmedChatCommon = {
    chatId: ChatId,
    updatedDate: Timestamp,
    readUpTo: number,
    latestKnownMessageId: number,
    messagesToDownload: number[],
    messagesDownloading: number[],
    confirmedMessages: ConfirmedMessage[],
    unconfirmedMessages: UnconfirmedMessage[]
}
