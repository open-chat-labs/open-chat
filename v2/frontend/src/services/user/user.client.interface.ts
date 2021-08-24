import type {
    UpdatesResponse,
    EventsResponse,
    UpdateArgs,
    CreateGroupResponse,
    CandidateGroupChat,
    DirectChatEvent,
} from "../../domain/chat/chat";

export interface IUserClient {
    getUpdates(userId: string, args: UpdateArgs): Promise<UpdatesResponse>;
    chatEvents(
        userId: string,
        fromIndex: number,
        toIndex: number
    ): Promise<EventsResponse<DirectChatEvent>>;
    createGroup(group: CandidateGroupChat): Promise<CreateGroupResponse>;
}
