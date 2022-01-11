import type { GroupSearchResponse } from "../../domain/search/search";

export interface IGroupIndexClient {
    search(searchTerm: string, maxResults?: number): Promise<GroupSearchResponse>;
}
