import type { AgentConfig } from "../config";
import type {
    ChatEvent,
    ChatSummary,
    CurrentChatState,
    EventsResponse,
    IndexRange,
    MarkReadRequest,
    MarkReadResponse,
    MergedUpdatesResponse,
    ThreadRead,
    UpdateArgs,
} from "./chat";
import type { StorageStatus } from "./data/data";
import type {
    CurrentUserResponse,
    PartialUserSummary,
    UserLookup,
    UsersArgs,
    UsersResponse,
} from "./user";

/**
 * Worker request types
 */

type WorkerRequestCommon<T = unknown> = {
    correlationId: string;
    payload: T;
};

export type WorkerRequest =
    | MarkMessagesReadRequest
    | GetAllCachedUsersRequest
    | GetUsersRequest
    | ChatEventsRequest
    | CreateUserClientRequest
    | InitRequest
    | CurrentUserRequest
    | WorkerUpdatesRequest
    | WorkerInitialStateRequest;

export type InitRequest = WorkerRequestCommon<Omit<AgentConfig, "logger">> & {
    kind: "init";
};

export type CurrentUserRequest = WorkerRequestCommon & {
    kind: "getCurrentUser";
};

export type MarkMessagesReadRequest = WorkerRequestCommon<MarkReadRequest> & {
    kind: "markMessagesRead";
};

export type GetAllCachedUsersRequest = WorkerRequestCommon & {
    kind: "getAllCachedUsers";
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
 * Worker response types
 */
export type WorkerResponse =
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

type WorkerEventCommon<T> = {
    kind: "worker_event";
    event: T;
};

export type FromWorker = WorkerResponse | WorkerEvent;

export type WorkerEvent =
    | RelayedMessagesReadFromServer
    | RelayedStorageUpdated
    | RelayedUsersLoaded;

export type WorkerCreateUserClientResponse = WorkerResponseCommon<undefined>;
export type GetCurrentUserResponse = WorkerResponseCommon<CurrentUserResponse>;
export type WorkerMarkReadResponse = WorkerResponseCommon<MarkReadResponse>;
export type WorkerGetAllCachedUsersResponse = WorkerResponseCommon<UserLookup>;
export type WorkerUpdatesResponse = WorkerResponseCommon<MergedUpdatesResponse>;
export type WorkerGetUsersResponse = WorkerResponseCommon<UsersResponse>;
export type WorkerChatEventsResponse = WorkerResponseCommon<EventsResponse<ChatEvent>>;
export type InitResponse = WorkerResponseCommon<undefined>;
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
