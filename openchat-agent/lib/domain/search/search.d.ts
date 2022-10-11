import type { MessageContent } from "../chat/chat";
import type { DataContent } from "../data/data";
export declare type GroupMatch = DataContent & {
    chatId: string;
    name: string;
    description: string;
};
export declare type MessageMatch = {
    chatId: string;
    messageIndex: number;
    content: MessageContent;
    sender: string;
    score: number;
};
export declare type GroupSearchResponse = TermInvalid | TermTooLong | TermTooShort | GroupSearchSuccess;
export declare type TermTooShort = {
    kind: "term_too_short";
};
export declare type TermTooLong = {
    kind: "term_too_long";
};
export declare type TermInvalid = {
    kind: "term_invalid";
};
export declare type ChatNotFound = {
    kind: "chat_not_found";
};
export declare type CallerNotInGroup = {
    kind: "caller_not_in_group";
};
export declare type GroupSearchSuccess = {
    kind: "success";
    matches: GroupMatch[];
};
export declare type SearchAllMessagesResponse = SearchMessagesSuccess | TermTooShort | TermTooLong | TermInvalid;
export declare type SearchGroupChatResponse = SearchMessagesSuccess | TermTooShort | TermTooLong | TermInvalid | CallerNotInGroup;
export declare type SearchDirectChatResponse = SearchMessagesSuccess | ChatNotFound | TermTooShort | TermTooLong | TermInvalid;
export declare type SearchMessagesSuccess = {
    kind: "success";
    matches: MessageMatch[];
};
