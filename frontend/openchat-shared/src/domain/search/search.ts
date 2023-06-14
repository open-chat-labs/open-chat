import type { CallerNotInGroup, MessageContent } from "../chat/chat";
import type { DataContent } from "../data/data";

export type GroupMatch = DataContent & {
    chatId: string;
    name: string;
    description: string;
};

export type SearchScope = "all" | "groups" | "communities";

export interface CommunityMatch {
    id: string;
    name: string;
    description: string;
    avatar: DataContent;
    banner: DataContent;
    memberCount: number;
    channelCount: number;
}

export type MessageMatch = {
    chatId: string;
    messageIndex: number;
    content: MessageContent;
    sender: string;
    score: number;
};

export type SearchResponse = TermInvalid | SearchSuccess;

export type TooManyUsers = {
    kind: "too_many_users";
};

export type TermInvalid = {
    kind: "term_invalid";
};

export type ChatNotFound = {
    kind: "chat_not_found";
};

export type SearchSuccess = {
    kind: "success";
    groupMatches: GroupMatch[];
    communityMatches: CommunityMatch[];
};

export type SearchGroupChatResponse =
    | SearchMessagesSuccess
    | TooManyUsers
    | TermInvalid
    | CallerNotInGroup;

export type SearchDirectChatResponse = SearchMessagesSuccess | ChatNotFound | TermInvalid;

export type SearchMessagesSuccess = {
    kind: "success";
    matches: MessageMatch[];
};
