import type {
    AddParticipantsResponse,
    EventsResponse,
    GroupChatEvent,
    GroupMessage,
    SendMessageResponse,
} from "../../domain/chat/chat";

export interface IGroupClient {
    chatEvents(fromIndex: number, toIndex: number): Promise<EventsResponse<GroupChatEvent>>;
    addParticipants(userIds: string[]): Promise<AddParticipantsResponse>;
    sendMessage(senderName: string, message: GroupMessage): Promise<SendMessageResponse>;
}
