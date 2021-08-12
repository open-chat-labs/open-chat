import type {
    UpdatesResponse,
    EventsResponse,
    UpdateArgs,
    CreateGroupResponse,
    CandidateGroupChat,
} from "../../domain/chat/chat";

export interface IUserClient {
    getUpdates(userId: string, args: UpdateArgs): Promise<UpdatesResponse>;
    chatEvents(userId: string, fromIndex: number, toIndex: number): Promise<EventsResponse>;
    chatEventsByIndex(userId: string, indexes: Set<number>): Promise<EventsResponse>;
    createGroup(group: CandidateGroupChat): Promise<CreateGroupResponse>;
}
