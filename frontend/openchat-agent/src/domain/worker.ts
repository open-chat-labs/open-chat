import type { AgentConfig } from "../config";
import type {
    ChatEvent,
    ChatSummary,
    CurrentChatState,
    DirectChatEvent,
    EventsResponse,
    EventWrapper,
    GroupChatDetails,
    GroupChatDetailsResponse,
    GroupChatEvent,
    IndexRange,
    MarkReadRequest,
    MarkReadResponse,
    MergedUpdatesResponse,
    Message,
    ThreadRead,
    UpdateArgs,
} from "./chat";
import type { StorageStatus } from "./data/data";
import type {
    CheckUsernameResponse,
    CurrentUserResponse,
    MigrateUserPrincipalResponse,
    PartialUserSummary,
    UserLookup,
    UsersArgs,
    UsersResponse,
    UserSummary,
} from "./user";

/**
 * Worker request types
 */

type WorkerRequestCommon<T = unknown> = {
    correlationId: string;
    payload: T;
};

export type WorkerRequest =
    | GetUserStorageLimitsRequest
    | InitUserPrincipalMigrationRequest
    | MigrateUserPrincipalRequest
    | SearchUsersRequest
    | CheckUsernameRequest
    | RehydrateMessageRequest
    | DirectChatEventsByEventIndexRequest
    | GroupChatEventsByEventIndexRequest
    | DirectChatEventsWindowRequest
    | GroupChatEventsWindowRequest
    | MarkAsOnlineRequest
    | GetGroupDetailsRequest
    | GetGroupDetailUpdatesRequest
    | MarkMessagesReadRequest
    | GetAllCachedUsersRequest
    | GetUsersRequest
    | ChatEventsRequest
    | CreateUserClientRequest
    | InitRequest
    | CurrentUserRequest
    | WorkerUpdatesRequest
    | WorkerInitialStateRequest;

export type GetUserStorageLimitsRequest = WorkerRequestCommon & {
    kind: "getUserStorageLimits";
};

export type InitUserPrincipalMigrationRequest = WorkerRequestCommon<{
    newPrincipal: string;
}> & {
    kind: "initUserPrincipalMigration";
};

export type MigrateUserPrincipalRequest = WorkerRequestCommon<{
    userId: string;
}> & {
    kind: "migrateUserPrincipal";
};

export type CheckUsernameRequest = WorkerRequestCommon<{
    username: string;
}> & {
    kind: "checkUsername";
};

export type SearchUsersRequest = WorkerRequestCommon<{
    searchTerm: string;
    maxResults: number;
}> & {
    kind: "searchUsers";
};

export type DirectChatEventsWindowRequest = WorkerRequestCommon<{
    eventIndexRange: IndexRange;
    theirUserId: string;
    messageIndex: number;
    latestClientMainEventIndex: number | undefined;
}> & {
    kind: "directChatEventsWindow";
};

export type GroupChatEventsWindowRequest = WorkerRequestCommon<{
    eventIndexRange: IndexRange;
    chatId: string;
    messageIndex: number;
    latestClientMainEventIndex: number | undefined;
}> & {
    kind: "groupChatEventsWindow";
};

export type DirectChatEventsByEventIndexRequest = WorkerRequestCommon<{
    theirUserId: string;
    eventIndexes: number[];
    threadRootMessageIndex: number | undefined;
    latestClientEventIndex: number | undefined;
}> & {
    kind: "directChatEventsByEventIndex";
};

export type GroupChatEventsByEventIndexRequest = WorkerRequestCommon<{
    chatId: string;
    eventIndexes: number[];
    threadRootMessageIndex: number | undefined;
    latestClientEventIndex: number | undefined;
}> & {
    kind: "groupChatEventsByEventIndex";
};

export type RehydrateMessageRequest = WorkerRequestCommon<{
    chatType: "direct" | "group";
    currentChatId: string;
    message: EventWrapper<Message>;
    threadRootMessageIndex: number | undefined;
    latestClientEventIndex: number | undefined;
}> & {
    kind: "rehydrateMessage";
};

export type InitRequest = WorkerRequestCommon<Omit<AgentConfig, "logger">> & {
    kind: "init";
};

export type CurrentUserRequest = WorkerRequestCommon & {
    kind: "getCurrentUser";
};

export type MarkMessagesReadRequest = WorkerRequestCommon<MarkReadRequest> & {
    kind: "markMessagesRead";
};

export type GetGroupDetailsRequest = WorkerRequestCommon<{
    chatId: string;
    latestEventIndex: number;
}> & {
    kind: "getGroupDetails";
};

export type GetGroupDetailUpdatesRequest = WorkerRequestCommon<{
    chatId: string;
    previous: GroupChatDetails;
}> & {
    kind: "getGroupDetailsUpdates";
};

export type GetAllCachedUsersRequest = WorkerRequestCommon & {
    kind: "getAllCachedUsers";
};

export type MarkAsOnlineRequest = WorkerRequestCommon & {
    kind: "markAsOnline";
};

export type GetUsersRequest = WorkerRequestCommon<{ users: UsersArgs; allowStale: boolean }> & {
    kind: "getUsers";
};

export type ChatEventsRequest = WorkerRequestCommon<{
    chat: ChatSummary;
    eventIndexRange: IndexRange;
    startIndex: number;
    ascending: boolean;
    threadRootMessageIndex: number | undefined;
    latestClientEventIndex: number | undefined;
}> & {
    kind: "chatEvents";
};

export type CreateUserClientRequest = WorkerRequestCommon<{ userId: string }> & {
    kind: "createUserClient";
};

export type WorkerUpdatesRequest = WorkerRequestCommon<{
    currentState: CurrentChatState;
    args: UpdateArgs;
    userStore: UserLookup;
    selectedChatId: string | undefined;
}> & {
    kind: "getUpdates";
};

export type WorkerInitialStateRequest = WorkerRequestCommon<{
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
    | WorkerGetUserStorageLimitsResponse
    | WorkerInitUserPrincipalMigrationResponse
    | WorkerMigrateUserPrincipalResponse
    | WorkerSearchUsersResponse
    | WorkerCheckUsernameResponse
    | WorkerRehydrateMessageResponse
    | WorkerDirectChatEventsWindowResponse
    | WorkerGroupChatEventsWindowResponse
    | WorkerDirectChatEventsByEventIndexResponse
    | WorkerGroupChatEventsByEventIndexResponse
    | WorkerMarkAsOnlineResponse
    | WorkerGetGroupDetailsResponse
    | WorkerGetGroupDetailUpdatesResponse
    | WorkerMarkReadResponse
    | WorkerGetAllCachedUsersResponse
    | WorkerGetUsersResponse
    | InitResponse
    | GetCurrentUserResponse
    | WorkerUpdatesResponse
    | WorkerChatEventsResponse
    | WorkerCreateUserClientResponse;

type WorkerResponseCommon<T> = {
    kind: "worker_response";
    correlationId: string;
    response: T;
};

export type FromWorker = WorkerResponse | WorkerEvent | WorkerError;

export type WorkerGetUserStorageLimitsResponse = WorkerResponseCommon<StorageStatus>;
export type WorkerInitUserPrincipalMigrationResponse = WorkerResponseCommon<undefined>;
export type WorkerCreateUserClientResponse = WorkerResponseCommon<undefined>;
export type GetCurrentUserResponse = WorkerResponseCommon<CurrentUserResponse>;
export type WorkerMarkReadResponse = WorkerResponseCommon<MarkReadResponse>;
export type WorkerGetAllCachedUsersResponse = WorkerResponseCommon<UserLookup>;
export type WorkerUpdatesResponse = WorkerResponseCommon<MergedUpdatesResponse>;
export type WorkerGetUsersResponse = WorkerResponseCommon<UsersResponse>;
export type WorkerChatEventsResponse = WorkerResponseCommon<EventsResponse<ChatEvent>>;
export type WorkerDirectChatEventsWindowResponse = WorkerResponseCommon<
    EventsResponse<DirectChatEvent>
>;
export type WorkerGroupChatEventsWindowResponse = WorkerResponseCommon<
    EventsResponse<GroupChatEvent>
>;
export type WorkerDirectChatEventsByEventIndexResponse = WorkerResponseCommon<
    EventsResponse<DirectChatEvent>
>;
export type WorkerGroupChatEventsByEventIndexResponse = WorkerResponseCommon<
    EventsResponse<GroupChatEvent>
>;
export type WorkerGetGroupDetailsResponse = WorkerResponseCommon<GroupChatDetailsResponse>;
export type WorkerGetGroupDetailUpdatesResponse = WorkerResponseCommon<GroupChatDetails>;
export type WorkerMarkAsOnlineResponse = WorkerResponseCommon<undefined>;
export type InitResponse = WorkerResponseCommon<undefined>;
export type WorkerCheckUsernameResponse = WorkerResponseCommon<CheckUsernameResponse>;
export type WorkerSearchUsersResponse = WorkerResponseCommon<UserSummary[]>;
export type WorkerRehydrateMessageResponse = WorkerResponseCommon<EventWrapper<Message>>;
export type WorkerMigrateUserPrincipalResponse = WorkerResponseCommon<MigrateUserPrincipalResponse>;

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
