import type {
    AddParticipantsResponse,
    EventsResponse,
    GroupChatEvent,
    ChangeAdminResponse,
    SendMessageResponse,
    RemoveParticipantResponse,
    MessageIndexRange,
    MarkReadResponse,
    UpdateGroupResponse,
    ToggleReactionResponse,
    IndexRange,
    EventWrapper,
    Message,
} from "../../domain/chat/chat";

export interface IGroupClient {
    chatEvents(
        eventIndexRange: IndexRange,
        startIndex: number,
        ascending: boolean,
        previouslyLoadedEvents?: EventWrapper<GroupChatEvent>[],
        iterations?: number
    ): Promise<EventsResponse<GroupChatEvent>>;
    addParticipants(userIds: string[]): Promise<AddParticipantsResponse>;
    sendMessage(senderName: string, message: Message): Promise<SendMessageResponse>;
    makeAdmin(userId: string): Promise<ChangeAdminResponse>;
    dismissAsAdmin(userId: string): Promise<ChangeAdminResponse>;
    removeParticipant(userId: string): Promise<RemoveParticipantResponse>;
    markMessagesRead(ranges: MessageIndexRange[]): Promise<MarkReadResponse>;
    updateGroup(name: string, desc: string, avatar?: Uint8Array): Promise<UpdateGroupResponse>;
    toggleReaction(messageId: bigint, reaction: string): Promise<ToggleReactionResponse>;
}
