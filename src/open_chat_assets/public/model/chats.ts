import { Option, Timestamp } from "./common";
import { Message } from "./messages";
import { UserId } from "./users";

export type ChatId = number;

export type Chat = DirectChat | GroupChat;

export type DirectChat = ChatCommon & {
    kind: "direct",
    them: UserId,
    chatId: Option<ChatId>
}

export type GroupChat = ChatCommon & {
    kind: "group",
    chatId: ChatId,
    subject: string,
    participants: UserId[]
}

type ChatCommon = {
    updatedDate: Timestamp,
    latestMessageId: number,
    readUpTo: number,
    confirmedOnServerUpTo: number, // Everything up to this is either a ConfirmedMessage or MissingMessage, everything after is an UnconfirmedMessage
    missingMessages: Set<number>,
    missingMessagesRequested: Set<number>,
    messages: Message[]
}
