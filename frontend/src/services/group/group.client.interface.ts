import type { User } from "../../domain/user/user";
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
    ChangeRoleResponse,
    GroupChatDetails,
    GroupChatDetailsResponse,
    UnblockUserResponse,
    DeleteGroupResponse,
    GroupChatSummary,
    MemberRole,
    PinMessageResponse,
    UnpinMessageResponse,
    RegisterPollVoteResponse,
    GroupPermissions,
} from "../../domain/chat/chat";
import type { SearchGroupChatResponse } from "../../domain/search/search";

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
    addParticipants(
        userIds: string[],
        myUsername: string,
        allowBlocked: boolean
    ): Promise<AddParticipantsResponse>;
    sendMessage(
        senderName: string,
        mentioned: User[],
        message: Message
    ): Promise<SendMessageResponse>;
    editMessage(message: Message): Promise<EditMessageResponse>;
    changeRole(userId: string, newRole: MemberRole): Promise<ChangeRoleResponse>;
    removeParticipant(userId: string): Promise<RemoveParticipantResponse>;
    updateGroup(
        name: string,
        desc: string,
        avatar?: Uint8Array,
        permissions?: GroupPermissions
    ): Promise<UpdateGroupResponse>;
    toggleReaction(messageId: bigint, reaction: string): Promise<ToggleReactionResponse>;
    deleteMessage(messageId: bigint): Promise<DeleteMessageResponse>;
    blockUser(userId: string): Promise<BlockUserResponse>;
    unblockUser(userId: string): Promise<UnblockUserResponse>;
    getGroupDetails(latestEventIndex: number): Promise<GroupChatDetailsResponse>;
    getGroupDetailsUpdates(previous: GroupChatDetails): Promise<GroupChatDetails>;
    deleteGroup(): Promise<DeleteGroupResponse>;
    getPublicSummary(): Promise<GroupChatSummary | undefined>;
    getMessagesByMessageIndex(messageIndexes: Set<number>): Promise<EventsResponse<Message>>;
    pinMessage(messageIndex: number): Promise<PinMessageResponse>;
    unpinMessage(messageIndex: number): Promise<UnpinMessageResponse>;
    registerPollVote(
        messageIdx: number,
        answerIdx: number,
        voteType: "register" | "delete"
    ): Promise<RegisterPollVoteResponse>;
    searchGroupChat(searchTerm: string, maxResults: number): Promise<SearchGroupChatResponse>;
}
