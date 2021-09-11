import type {
    AddParticipantsResponse,
    EventsResponse,
    GroupChatEvent,
    GroupMessage,
    ChangeAdminResponse,
    SendMessageResponse,
    RemoveParticipantResponse,
} from "../../domain/chat/chat";

export interface IGroupClient {
    chatEvents(fromIndex: number, toIndex: number): Promise<EventsResponse<GroupChatEvent>>;
    addParticipants(userIds: string[]): Promise<AddParticipantsResponse>;
    sendMessage(senderName: string, message: GroupMessage): Promise<SendMessageResponse>;
    makeAdmin(userId: string): Promise<ChangeAdminResponse>;
    dismissAsAdmin(userId: string): Promise<ChangeAdminResponse>;
    removeParticipant(userId: string): Promise<RemoveParticipantResponse>;
}
