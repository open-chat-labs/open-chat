import type { AccessGate } from "../access";
import type {
    CallerNotInGroup,
    ChatIdentifier,
    GroupChatIdentifier,
    MessageContent,
} from "../chat/chat";
import type { CommunityIdentifier } from "../community";
import type { DataContent } from "../data/data";
import type { ChatNotFound } from "../response";

export type GroupMatch = DataContent & {
    chatId: GroupChatIdentifier;
    name: string;
    description: string;
};

export interface CommunityMatch {
    id: CommunityIdentifier;
    name: string;
    description: string;
    avatar: DataContent;
    banner: DataContent;
    memberCount: number;
    channelCount: number;
    gate: AccessGate;
}

export type MessageMatch = {
    chatId: ChatIdentifier;
    messageIndex: number;
    content: MessageContent;
    sender: string;
    score: number;
};

export type ExploreCommunitiesResponse = TermInvalid | ExploreSuccess;
export type GroupSearchResponse = TermInvalid | GroupSearchSuccess;

export type TooManyUsers = {
    kind: "too_many_users";
};

export type TermInvalid = {
    kind: "term_invalid";
};

export type GroupSearchSuccess = {
    kind: "success";
    matches: GroupMatch[];
};

export type ExploreSuccess = {
    kind: "success";
    matches: CommunityMatch[];
};

export type SearchSuccess = {
    kind: "success";
    matches: GroupMatch[];
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
