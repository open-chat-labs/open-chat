import type { AccessGateConfig } from "../access";
import type { BotDefinition } from "../bots";
import type { ChatIdentifier, GroupChatIdentifier, GroupSubtype } from "../chat/chat";
import type { ChannelMatch, CommunityIdentifier } from "../community";
import type { DataContent } from "../data/data";
import type { OCError } from "../error";
import type { ChatNotFound, Failure, Offline } from "../response";

export type GroupMatch = DataContent & {
    kind: "group_match";
    chatId: GroupChatIdentifier;
    name: string;
    description: string;
    subtype: GroupSubtype | undefined;
    verified: boolean;
};

export interface CommunityMatch {
    kind: "community_match";
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
    verified: boolean;
}

export type MessageMatch = {
    chatId: ChatIdentifier;
    messageIndex: number;
    score: number;
};

export type BotMatch = {
    kind: "bot_match";
    id: string;
    name: string;
    ownerId: string;
    avatarUrl?: string;
    definition: BotDefinition;
    endpoint: string;
};

export type ExploreCommunitiesResponse = TermInvalid | ExploreSuccess | Offline | OCError;
export type GroupSearchResponse = TermInvalid | GroupSearchSuccess | Offline | OCError;
export type ExploreChannelsResponse = Failure | ExploreChannelsSuccess | Offline;
export type ExploreBotsResponse = TermInvalid | ExploreBotsSuccess | Offline | OCError;

export type TooManyUsers = {
    kind: "too_many_users";
};

export type TermInvalid = {
    kind: "term_invalid";
};

export type ExploreBotsSuccess = {
    kind: "success";
    matches: BotMatch[];
    total: number;
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

export type SearchDirectChatResponse = SearchMessagesSuccess | ChatNotFound | TermInvalid | OCError | Offline;

export type SearchMessagesSuccess = {
    kind: "success";
    matches: MessageMatch[];
};
