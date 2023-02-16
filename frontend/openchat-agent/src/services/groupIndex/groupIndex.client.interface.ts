import type {
    DeleteFrozenGroupResponse,
    FilterGroupsResponse,
    FreezeGroupResponse,
    GroupChatSummary,
    GroupSearchResponse,
    UnfreezeGroupResponse
} from "openchat-shared";

export interface IGroupIndexClient {
    filterGroups(chatIds: string[], activeSince: bigint): Promise<FilterGroupsResponse>;
    recommendedGroups(exclusions: string[]): Promise<GroupChatSummary[]>;
    search(searchTerm: string, maxResults?: number): Promise<GroupSearchResponse>;
    freezeGroup(chatId: string, reason: string | undefined): Promise<FreezeGroupResponse>;
    unfreezeGroup(chatId: string): Promise<UnfreezeGroupResponse>;
    deleteFrozenGroup(chatId: string): Promise<DeleteFrozenGroupResponse>;
}
