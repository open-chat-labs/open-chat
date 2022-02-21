import type { MessageContent } from "../chat/chat";
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

export type TermInvalid = {
    kind: "term_invalid";
};

export type GroupSearchSuccess = {
    kind: "success";
    matches: GroupMatch[];
};

export type SearchAllMessagesResponse = SearchAllSuccess | TermTooShort | TermTooLong | TermInvalid;

export type SearchAllSuccess = {
    kind: "success";
    matches: MessageMatch[];
};
