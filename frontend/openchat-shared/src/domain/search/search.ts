import type { AccessGate, AccessGateConfig } from "../access";
import type {
    ChatIdentifier,
    GroupChatIdentifier,
    GroupSubtype,
    MessageContent,
} from "../chat/chat";
import type { ChannelMatch, CommunityIdentifier } from "../community";
import type { DataContent } from "../data/data";
import type { ChatNotFound, Failure, Offline } from "../response";

export type GroupMatch = DataContent & {
    chatId: GroupChatIdentifier;
    name: string;
    description: string;
    subtype: GroupSubtype | undefined;
};

export interface CommunityMatch {
    id: CommunityIdentifier;
    name: string;
    description: string;
    avatar: DataContent;
    banner: DataContent;
    memberCount: number;
    channelCount: number;
    gateConfig: AccessGateConfig;
    flags: number;
    primaryLanguage: string;
}

export type MessageMatch = {
    chatId: ChatIdentifier;
    messageIndex: number;
    content: MessageContent;
    sender: string;
    score: number;
};

export type ExploreCommunitiesResponse = TermInvalid | ExploreSuccess | Offline;
export type GroupSearchResponse = TermInvalid | GroupSearchSuccess | Offline;
export type ExploreChannelsResponse = Failure | ExploreChannelsSuccess | Offline;

export type TooManyUsers = {
    kind: "too_many_users";
};

export type TermInvalid = {
    kind: "term_invalid";
};

export type ExploreChannelsSuccess = {
    kind: "success";
    matches: ChannelMatch[];
    total: number;
};

export type GroupSearchSuccess = {
    kind: "success";
    matches: GroupMatch[];
    total: number;
};

export type ExploreSuccess = {
    kind: "success";
    matches: CommunityMatch[];
    total: number;
};

export type SearchSuccess = {
    kind: "success";
    matches: GroupMatch[];
};

export type SearchGroupChatResponse = SearchMessagesSuccess | Failure | Offline;

export type SearchDirectChatResponse = SearchMessagesSuccess | ChatNotFound | TermInvalid | Offline;

export type SearchMessagesSuccess = {
    kind: "success";
    matches: MessageMatch[];
};
