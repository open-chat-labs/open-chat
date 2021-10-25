import type {
    AddParticipantsResponse,
    EventsResponse,
    GroupChatEvent,
    SendMessageResponse,
    RemoveParticipantResponse,
    UpdateGroupResponse,
    ToggleReactionResponse,
    IndexRange,
    EventWrapper,
    Message,
    DeleteMessageResponse,
    EditMessageResponse,
    BlockUserResponse,
    MakeAdminResponse,
    RemoveAdminResponse,
} from "../../domain/chat/chat";

export interface IGroupClient {
    chatEventsByIndex(eventIndexes: number[]): Promise<EventsResponse<GroupChatEvent>>;
    chatEventsWindow(
        eventIndexRange: IndexRange,
        messageIndex: number
    ): Promise<EventsResponse<GroupChatEvent>>;
    chatEvents(
        eventIndexRange: IndexRange,
        startIndex: number,
        ascending: boolean,
        previouslyLoadedEvents?: EventWrapper<GroupChatEvent>[],
        iterations?: number
    ): Promise<EventsResponse<GroupChatEvent>>;
    addParticipants(userIds: string[]): Promise<AddParticipantsResponse>;
    sendMessage(senderName: string, message: Message): Promise<SendMessageResponse>;
    editMessage(message: Message): Promise<EditMessageResponse>;
    makeAdmin(userId: string): Promise<MakeAdminResponse>;
    dismissAsAdmin(userId: string): Promise<RemoveAdminResponse>;
    removeParticipant(userId: string): Promise<RemoveParticipantResponse>;
    updateGroup(name: string, desc: string, avatar?: Uint8Array): Promise<UpdateGroupResponse>;
    toggleReaction(messageId: bigint, reaction: string): Promise<ToggleReactionResponse>;
    deleteMessage(messageId: bigint): Promise<DeleteMessageResponse>;
    blockUser(userId: string): Promise<BlockUserResponse>;
}
