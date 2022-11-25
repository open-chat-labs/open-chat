import type {
    User,
    AddMembersResponse,
    EventsResponse,
    GroupChatEvent,
    SendMessageResponse,
    RemoveMemberResponse,
    UpdateGroupResponse,
    AddRemoveReactionResponse,
    IndexRange,
    Message,
    DeleteMessageResponse,
    UndeleteMessageResponse,
    EditMessageResponse,
    BlockUserResponse,
    ChangeRoleResponse,
    GroupChatDetails,
    GroupChatDetailsResponse,
    UnblockUserResponse,
    GroupChatSummary,
    MemberRole,
    PinMessageResponse,
    UnpinMessageResponse,
    RegisterPollVoteResponse,
    GroupPermissions,
    MakeGroupPrivateResponse,
    InviteCodeResponse,
    EnableInviteCodeResponse,
    DisableInviteCodeResponse,
    ResetInviteCodeResponse,
    ThreadPreviewsResponse,
    RegisterProposalVoteResponse,
    GroupRules,
    SearchGroupChatResponse,
} from "openchat-shared";

export interface IGroupClient {
    chatEventsByIndex(
        eventIndexes: number[],
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<GroupChatEvent>>;
    chatEventsWindow(
        eventIndexRange: IndexRange,
        messageIndex: number,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<GroupChatEvent>>;
    chatEvents(
        eventIndexRange: IndexRange,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<GroupChatEvent>>;
    addMembers(
        userIds: string[],
        myUsername: string,
        allowBlocked: boolean
    ): Promise<AddMembersResponse>;
    sendMessage(
        senderName: string,
        mentioned: User[],
        message: Message,
        threadRootMessageIndex?: number
    ): Promise<[SendMessageResponse, Message]>;
    editMessage(message: Message, threadRootMessageIndex?: number): Promise<EditMessageResponse>;
    changeRole(userId: string, newRole: MemberRole): Promise<ChangeRoleResponse>;
    removeMember(userId: string): Promise<RemoveMemberResponse>;
    updateGroup(
        name?: string,
        desc?: string,
        rules?: GroupRules,
        permissions?: Partial<GroupPermissions>,
        avatar?: Uint8Array
    ): Promise<UpdateGroupResponse>;
    addReaction(
        messageId: bigint,
        reaction: string,
        username: string,
        threadRootMessageIndex?: number
    ): Promise<AddRemoveReactionResponse>;
    removeReaction(
        messageId: bigint,
        reaction: string,
        threadRootMessageIndex?: number
    ): Promise<AddRemoveReactionResponse>;
    deleteMessage(
        messageId: bigint,
        threadRootMessageIndex?: number
    ): Promise<DeleteMessageResponse>;
    undeleteMessage(
        messageId: bigint,
        threadRootMessageIndex?: number
    ): Promise<UndeleteMessageResponse>;
    blockUser(userId: string): Promise<BlockUserResponse>;
    unblockUser(userId: string): Promise<UnblockUserResponse>;
    getGroupDetails(latestEventIndex: number): Promise<GroupChatDetailsResponse>;
    getGroupDetailsUpdates(previous: GroupChatDetails): Promise<GroupChatDetails>;
    makeGroupPrivate(): Promise<MakeGroupPrivateResponse>;
    getPublicSummary(): Promise<GroupChatSummary | undefined>;
    getRules(): Promise<GroupRules | undefined>;
    getMessagesByMessageIndex(
        messageIndexes: Set<number>,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<Message>>;
    pinMessage(messageIndex: number): Promise<PinMessageResponse>;
    unpinMessage(messageIndex: number): Promise<UnpinMessageResponse>;
    registerPollVote(
        messageIdx: number,
        answerIdx: number,
        voteType: "register" | "delete",
        threadRootMessageIndex?: number
    ): Promise<RegisterPollVoteResponse>;
    searchGroupChat(searchTerm: string, maxResults: number): Promise<SearchGroupChatResponse>;
    getInviteCode(): Promise<InviteCodeResponse>;
    enableInviteCode(): Promise<EnableInviteCodeResponse>;
    disableInviteCode(): Promise<DisableInviteCodeResponse>;
    resetInviteCode(): Promise<ResetInviteCodeResponse>;
    threadPreviews(
        threadRootMessageIndexes: number[],
        latestClientThreadUpdate: bigint | undefined
    ): Promise<ThreadPreviewsResponse>;
    registerProposalVote(messageIdx: number, adopt: boolean): Promise<RegisterProposalVoteResponse>;
}
