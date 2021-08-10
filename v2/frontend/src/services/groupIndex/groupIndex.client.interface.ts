import type { CandidateGroupChat, CreateGroupChatResponse } from "../../domain/chat/chat";

export interface IGroupIndexClient {
    createGroup(candidate: CandidateGroupChat): Promise<CreateGroupChatResponse>;
}
