import type { GroupSearchResponse } from "openchat-shared";

export interface IGroupIndexClient {
    search(searchTerm: string, maxResults?: number): Promise<GroupSearchResponse>;
}
