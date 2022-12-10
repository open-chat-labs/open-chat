import type { FilterGroupsResponse, FreezeGroupResponse, GroupSearchResponse, UnfreezeGroupResponse } from "openchat-shared";

export interface IGroupIndexClient {
    filterGroups(chatIds: string[], activeSince: bigint): Promise<FilterGroupsResponse>;
    search(searchTerm: string, maxResults?: number): Promise<GroupSearchResponse>;
    freezeGroup(chatId: string, reason: string | undefined): Promise<FreezeGroupResponse>;
    unfreezeGroup(chatId: string): Promise<UnfreezeGroupResponse>;
}
