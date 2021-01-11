import { ConfirmedMessage, UnconfirmedMessage } from "./messages";
import { UserId } from "./users";

export type ChatId = BigInt;

export type Chat = ConfirmedChat | UnconfirmedChat;

export type ConfirmedChat = DirectChat | GroupChat;
export type UnconfirmedChat = NewDirectChat | NewGroupChat;

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
    unconfirmedMessages: UnconfirmedMessage[]
}

export type NewGroupChat = {
    kind: "newGroup",
    id: Symbol,
    subject: string,
    participants: UserId[],
    unconfirmedMessages: UnconfirmedMessage[]
}

type ConfirmedChatCommon = {
    chatId: ChatId,
    updatedDate: Date,
    readUpTo: number,
    latestKnownMessageId: number,
    messagesToDownload: number[],
    messagesDownloading: number[],
    confirmedMessages: ConfirmedMessage[],
    unconfirmedMessages: UnconfirmedMessage[]
}
