import type {
    AddParticipantsResponse,
    EventsResponse,
    GroupChatEvent,
} from "../../domain/chat/chat";

export interface IGroupClient {
    chatEvents(fromIndex: number, toIndex: number): Promise<EventsResponse<GroupChatEvent>>;
    addParticipants(userIds: string[]): Promise<AddParticipantsResponse>;
}
