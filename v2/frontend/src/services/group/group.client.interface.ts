import type {
    AddParticipantsResponse,
    EventsResponse,
    GroupChatEvent,
    GroupMessage,
    ChangeAdminResponse,
    SendMessageResponse,
    RemoveParticipantResponse,
    MessageIndexRange,
    MarkReadResponse,
    UpdateGroupResponse,
} from "../../domain/chat/chat";

export interface IGroupClient {
    chatEvents(fromIndex: number, toIndex: number): Promise<EventsResponse<GroupChatEvent>>;
    addParticipants(userIds: string[]): Promise<AddParticipantsResponse>;
    sendMessage(senderName: string, message: GroupMessage): Promise<SendMessageResponse>;
    makeAdmin(userId: string): Promise<ChangeAdminResponse>;
    dismissAsAdmin(userId: string): Promise<ChangeAdminResponse>;
    removeParticipant(userId: string): Promise<RemoveParticipantResponse>;
    markMessagesRead(ranges: MessageIndexRange[]): Promise<MarkReadResponse>;
    updateGroup(name: string, desc: string, avatar?: Uint8Array): Promise<UpdateGroupResponse>;
}
