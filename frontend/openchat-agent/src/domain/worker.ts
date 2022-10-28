import type { AgentConfig } from "../config";
import type {
    AddRemoveReactionResponse,
    BlockUserResponse,
    ChatEvent,
    ChatSummary,
    CurrentChatState,
    DeleteGroupResponse,
    DeleteMessageResponse,
    DirectChatEvent,
    EditMessageResponse,
    EventsResponse,
    EventWrapper,
    GroupChatDetails,
    GroupChatDetailsResponse,
    GroupChatEvent,
    GroupChatSummary,
    GroupPermissions,
    GroupRules,
    IndexRange,
    JoinGroupResponse,
    LeaveGroupResponse,
    ListNervousSystemFunctionsResponse,
    MakeGroupPrivateResponse,
    MarkReadRequest,
    MarkReadResponse,
    MergedUpdatesResponse,
    Message,
    PinMessageResponse,
    RegisterPollVoteResponse,
    SendMessageResponse,
    ThreadRead,
    UnblockUserResponse,
    UnpinMessageResponse,
    UpdateArgs,
    UpdateGroupResponse,
} from "./chat";
import type { BlobReference, StorageStatus } from "./data/data";
import type { ToggleMuteNotificationResponse } from "./notifications";
import type {
    ArchiveChatResponse,
    CheckUsernameResponse,
    CreatedUser,
    CurrentUserResponse,
    MigrateUserPrincipalResponse,
    PartialUserSummary,
    PinChatResponse,
    UnpinChatResponse,
    User,
    UserLookup,
    UsersArgs,
    UsersResponse,
    UserSummary,
} from "./user";

/**
 * Worker request types
 */

type Request<T = unknown> = {
    correlationId: string;
    payload: T;
};

export type WorkerRequest =
    | EditMessage
    | SendMessage
    | UnpinMessage
    | PinMessage
    | ListNervousSystemFunctions
    | BlockUserFromGroup
    | AddGroupChatReaction
    | RemoveGroupChatReaction
    | RemoveDirectChatReaction
    | AddDirectChatReaction
    | DeleteMessage
    | RegisterPollVote
    | UpdateGroup
    | JoinGroup
    | LeaveGroup
    | DeleteGroup
    | MakeGroupPrivate
    | SetUserAvatar
    | UnblockUserFromDirectChat
    | BlockUserFromDirectChat
    | UnpinChat
    | PinChat
    | UnArchiveChat
    | ArchiveChat
    | ToggleMuteNotifications
    | GetPublicGroupSummary
    | GetUserStorageLimits
    | InitUserPrincipalMigration
    | MigrateUserPrincipal
    | SearchUsers
    | CheckUsername
    | RehydrateMessage
    | DirectChatEventsByEventIndex
    | GroupChatEventsByEventIndex
    | DirectChatEventsWindow
    | GroupChatEventsWindow
    | MarkAsOnline
    | GetGroupDetails
    | GetGroupDetailUpdates
    | MarkMessagesRead
    | GetAllCachedUsers
    | GetUsers
    | ChatEvents
    | CreateUserClient
    | Init
    | CurrentUser
    | GetUpdates
    | GetInitialState;

type EditMessage = Request<{
    chat: ChatSummary;
    msg: Message;
    threadRootMessageIndex?: number;
}> & {
    kind: "editMessage";
};

type SendMessage = Request<{
    chat: ChatSummary;
    user: CreatedUser;
    mentioned: User[];
    msg: Message;
    threadRootMessageIndex?: number;
}> & {
    kind: "sendMessage";
};

type PinMessage = Request<{
    chatId: string;
    messageIndex: number;
}> & {
    kind: "pinMessage";
};

type UnpinMessage = Request<{
    chatId: string;
    messageIndex: number;
}> & {
    kind: "unpinMessage";
};

type ListNervousSystemFunctions = Request<{
    snsGovernanceCanisterId: string;
}> & {
    kind: "listNervousSystemFunctions";
};

type BlockUserFromGroup = Request<{
    chatId: string;
    userId: string;
}> & {
    kind: "blockUserFromGroupChat";
};

type AddGroupChatReaction = Request<{
    chatId: string;
    messageId: bigint;
    reaction: string;
    username: string;
    threadRootMessageIndex?: number;
}> & {
    kind: "addGroupChatReaction";
};

type RemoveGroupChatReaction = Request<{
    chatId: string;
    messageId: bigint;
    reaction: string;
    threadRootMessageIndex?: number;
}> & {
    kind: "removeGroupChatReaction";
};

type RemoveDirectChatReaction = Request<{
    otherUserId: string;
    messageId: bigint;
    reaction: string;
    threadRootMessageIndex?: number;
}> & {
    kind: "removeDirectChatReaction";
};

type AddDirectChatReaction = Request<{
    otherUserId: string;
    messageId: bigint;
    reaction: string;
    username: string;
    threadRootMessageIndex?: number;
}> & {
    kind: "addDirectChatReaction";
};

type DeleteMessage = Request<{
    chat: ChatSummary;
    messageId: bigint;
    threadRootMessageIndex?: number;
}> & {
    kind: "deleteMessage";
};

type RegisterPollVote = Request<{
    chatId: string;
    messageIdx: number;
    answerIdx: number;
    voteType: "register" | "delete";
    threadRootMessageIndex?: number;
}> & {
    kind: "registerPollVote";
};

type UpdateGroup = Request<{
    chatId: string;
    name?: string;
    desc?: string;
    rules?: GroupRules;
    permissions?: Partial<GroupPermissions>;
    avatar?: Uint8Array;
}> & {
    kind: "updateGroup";
};

type JoinGroup = Request<{
    chatId: string;
}> & {
    kind: "joinGroup";
};

type LeaveGroup = Request<{
    chatId: string;
}> & {
    kind: "leaveGroup";
};

type DeleteGroup = Request<{
    chatId: string;
}> & {
    kind: "deleteGroup";
};

type MakeGroupPrivate = Request<{
    chatId: string;
}> & {
    kind: "makeGroupPrivate";
};

type SetUserAvatar = Request<{
    data: Uint8Array;
}> & {
    kind: "setUserAvatar";
};

type UnblockUserFromDirectChat = Request<{
    userId: string;
}> & {
    kind: "unblockUserFromDirectChat";
};

type BlockUserFromDirectChat = Request<{
    userId: string;
}> & {
    kind: "blockUserFromDirectChat";
};

type UnpinChat = Request<{
    chatId: string;
}> & {
    kind: "unpinChat";
};

type PinChat = Request<{
    chatId: string;
}> & {
    kind: "pinChat";
};

type UnArchiveChat = Request<{
    chatId: string;
}> & {
    kind: "unarchiveChat";
};

type ArchiveChat = Request<{
    chatId: string;
}> & {
    kind: "archiveChat";
};

type ToggleMuteNotifications = Request<{
    chatId: string;
    muted: boolean;
}> & {
    kind: "toggleMuteNotifications";
};

type GetPublicGroupSummary = Request<{
    chatId: string;
}> & {
    kind: "getPublicGroupSummary";
};

type GetUserStorageLimits = Request & {
    kind: "getUserStorageLimits";
};

type InitUserPrincipalMigration = Request<{
    newPrincipal: string;
}> & {
    kind: "initUserPrincipalMigration";
};

type MigrateUserPrincipal = Request<{
    userId: string;
}> & {
    kind: "migrateUserPrincipal";
};

type CheckUsername = Request<{
    username: string;
}> & {
    kind: "checkUsername";
};

type SearchUsers = Request<{
    searchTerm: string;
    maxResults: number;
}> & {
    kind: "searchUsers";
};

type DirectChatEventsWindow = Request<{
    eventIndexRange: IndexRange;
    theirUserId: string;
    messageIndex: number;
    latestClientMainEventIndex: number | undefined;
}> & {
    kind: "directChatEventsWindow";
};

type GroupChatEventsWindow = Request<{
    eventIndexRange: IndexRange;
    chatId: string;
    messageIndex: number;
    latestClientMainEventIndex: number | undefined;
}> & {
    kind: "groupChatEventsWindow";
};

type DirectChatEventsByEventIndex = Request<{
    theirUserId: string;
    eventIndexes: number[];
    threadRootMessageIndex: number | undefined;
    latestClientEventIndex: number | undefined;
}> & {
    kind: "directChatEventsByEventIndex";
};

type GroupChatEventsByEventIndex = Request<{
    chatId: string;
    eventIndexes: number[];
    threadRootMessageIndex: number | undefined;
    latestClientEventIndex: number | undefined;
}> & {
    kind: "groupChatEventsByEventIndex";
};

type RehydrateMessage = Request<{
    chatType: "direct" | "group";
    currentChatId: string;
    message: EventWrapper<Message>;
    threadRootMessageIndex: number | undefined;
    latestClientEventIndex: number | undefined;
}> & {
    kind: "rehydrateMessage";
};

type Init = Request<Omit<AgentConfig, "logger">> & {
    kind: "init";
};

type CurrentUser = Request & {
    kind: "getCurrentUser";
};

type MarkMessagesRead = Request<MarkReadRequest> & {
    kind: "markMessagesRead";
};

type GetGroupDetails = Request<{
    chatId: string;
    latestEventIndex: number;
}> & {
    kind: "getGroupDetails";
};

type GetGroupDetailUpdates = Request<{
    chatId: string;
    previous: GroupChatDetails;
}> & {
    kind: "getGroupDetailsUpdates";
};

type GetAllCachedUsers = Request & {
    kind: "getAllCachedUsers";
};

type MarkAsOnline = Request & {
    kind: "markAsOnline";
};

type GetUsers = Request<{ users: UsersArgs; allowStale: boolean }> & {
    kind: "getUsers";
};

type ChatEvents = Request<{
    chat: ChatSummary;
    eventIndexRange: IndexRange;
    startIndex: number;
    ascending: boolean;
    threadRootMessageIndex: number | undefined;
    latestClientEventIndex: number | undefined;
}> & {
    kind: "chatEvents";
};

type CreateUserClient = Request<{ userId: string }> & {
    kind: "createUserClient";
};

type GetUpdates = Request<{
    currentState: CurrentChatState;
    args: UpdateArgs;
    userStore: UserLookup;
    selectedChatId: string | undefined;
}> & {
    kind: "getUpdates";
};

type GetInitialState = Request<{
    userStore: UserLookup;
    selectedChatId: string | undefined;
}> & {
    kind: "getInitialState";
};

/**
 * Worker error type
 */
export type WorkerError = {
    kind: "worker_error";
    correlationId: string;
    error: unknown;
};

/**
 * Worker response types
 */
export type WorkerResponse =
    | Response<EditMessageResponse>
    | Response<[SendMessageResponse, Message]>
    | Response<UnpinMessageResponse>
    | Response<PinMessageResponse>
    | Response<ListNervousSystemFunctionsResponse>
    | Response<AddRemoveReactionResponse>
    | Response<DeleteMessageResponse>
    | Response<RegisterPollVoteResponse>
    | Response<UpdateGroupResponse>
    | Response<JoinGroupResponse>
    | Response<DeleteGroupResponse>
    | Response<LeaveGroupResponse>
    | Response<MakeGroupPrivateResponse>
    | Response<BlobReference>
    | Response<UnblockUserResponse>
    | Response<BlockUserResponse>
    | Response<UnpinChatResponse>
    | Response<PinChatResponse>
    | Response<ArchiveChatResponse>
    | Response<ArchiveChatResponse>
    | Response<ToggleMuteNotificationResponse>
    | Response<GroupChatSummary | undefined>
    | Response<StorageStatus>
    | Response<undefined>
    | Response<MigrateUserPrincipalResponse>
    | Response<UserSummary[]>
    | Response<CheckUsernameResponse>
    | Response<EventWrapper<Message>>
    | Response<EventsResponse<DirectChatEvent>>
    | Response<EventsResponse<GroupChatEvent>>
    | Response<EventsResponse<DirectChatEvent>>
    | Response<EventsResponse<GroupChatEvent>>
    | Response<undefined>
    | Response<GroupChatDetailsResponse>
    | Response<GroupChatDetails>
    | Response<MarkReadResponse>
    | Response<UserLookup>
    | Response<UsersResponse>
    | Response<undefined>
    | Response<CurrentUserResponse>
    | Response<MergedUpdatesResponse>
    | Response<EventsResponse<ChatEvent>>
    | Response<undefined>;

type Response<T> = {
    kind: "worker_response";
    correlationId: string;
    response: T;
};

export type FromWorker = WorkerResponse | WorkerEvent | WorkerError;

/** Worker event types */
type WorkerEventCommon<T> = {
    kind: "worker_event";
    event: T;
};

export type WorkerEvent =
    | RelayedMessagesReadFromServer
    | RelayedStorageUpdated
    | RelayedUsersLoaded;

export type RelayedMessagesReadFromServer = WorkerEventCommon<{
    subkind: "messages_read_from_server";
    chatId: string;
    readByMeUpTo: number | undefined;
    threadsRead: ThreadRead[];
}>;
export type RelayedStorageUpdated = WorkerEventCommon<{
    subkind: "storage_updated";
    status: StorageStatus;
}>;
export type RelayedUsersLoaded = WorkerEventCommon<{
    subkind: "users_loaded";
    users: PartialUserSummary[];
}>;
