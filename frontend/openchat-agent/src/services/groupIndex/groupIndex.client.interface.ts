import type { FreezeGroupResponse, GroupSearchResponse } from "openchat-shared";

export interface IGroupIndexClient {
    search(searchTerm: string, maxResults?: number): Promise<GroupSearchResponse>;
    freezeGroup(chatId: string): Promise<FreezeGroupResponse>;
}
