import { Timestamp } from "./common";
import { Message } from "./messages";
import { UserId } from "./users";

export type ChatId = number;

export type Chat = DirectChat | GroupChat;

export type DirectChat = {
    kind: "direct",
    them: UserId,
    updatedDate: Timestamp,
    latestMessageId: number,
    readUpTo: number,
    messages: Message[]
}

export type GroupChat = {
    kind: "group",
    chatId: ChatId,
    subject: string,
    updatedDate: Timestamp,
    participants: UserId[],
    latestMessageId: number,
    readUpTo: number,
    messages: Message[];
}
