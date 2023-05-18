import type { CallerNotInGroup, MessageContent } from "../chat/chat";
import type { DataContent } from "../data/data";

export type GroupMatch = DataContent & {
    chatId: string;
    name: string;
    description: string;
};

export type MessageMatch = {
    chatId: string;
    messageIndex: number;
    content: MessageContent;
    sender: string;
    score: number;
};

export type GroupSearchResponse = TermInvalid | TermTooLong | TermTooShort | GroupSearchSuccess;

export type TermTooShort = {
    kind: "term_too_short";
};

export type TermTooLong = {
    kind: "term_too_long";
};

export type TooManyUsers = {
    kind: "too_many_users";
};

export type TermInvalid = {
    kind: "term_invalid";
};

export type ChatNotFound = {
    kind: "chat_not_found";
};

export type GroupSearchSuccess = {
    kind: "success";
    matches: GroupMatch[];
};

export type SearchGroupChatResponse =
    | SearchMessagesSuccess
    | TermTooShort
    | TermTooLong
    | TooManyUsers
    | TermInvalid
    | CallerNotInGroup;

export type SearchDirectChatResponse =
    | SearchMessagesSuccess
    | ChatNotFound
    | TermTooShort
    | TermTooLong
    | TermInvalid;

export type SearchMessagesSuccess = {
    kind: "success";
    matches: MessageMatch[];
};
