import type { GroupChatSummary } from "../../domain/chat/chat";
import type { GroupSearchResponse } from "../../domain/search/search";

export interface IGroupIndexClient {
    search(searchTerm: string, maxResults?: number): Promise<GroupSearchResponse>;
    getRecommendedGroups(): Promise<GroupChatSummary[]>;
}
