import { DBSchema, IDBPDatabase } from "idb";
import type { ChatEvent, EventsResponse, EventsSuccessResult, EventWrapper, GroupChatDetails, IndexRange, MergedUpdatesResponse, Message, SendMessageResponse } from "../domain/chat/chat";
export declare type Database = Promise<IDBPDatabase<ChatSchema>>;
declare type EnhancedWrapper<T extends ChatEvent> = EventWrapper<T> & {
    chatId: string;
    messageKey: string | undefined;
};
export interface ChatSchema extends DBSchema {
    chats: {
        key: string;
        value: MergedUpdatesResponse;
    };
    chat_events: {
        key: string;
        value: EnhancedWrapper<ChatEvent>;
        indexes: {
            messageIdx: string;
        };
    };
    thread_events: {
        key: string;
        value: EnhancedWrapper<ChatEvent>;
        indexes: {
            messageIdx: string;
        };
    };
    group_details: {
        key: string;
        value: GroupChatDetails;
    };
    soft_disabled: {
        key: string;
        value: boolean;
    };
}
export declare function cachingLocallyDisabled(): boolean;
export declare function createCacheKey(chatId: string, index: number, threadRootMessageIndex?: number): string;
export declare function openCache(principal: string): Database | undefined;
export declare function removeCachedChat(db: Database, userId: string, chatId: string): Promise<void>;
export declare function getCachedChats(db: Database, userId: string): Promise<MergedUpdatesResponse | undefined>;
export declare function setCachedChats(db: Database, userId: string, data: MergedUpdatesResponse): Promise<void>;
export declare function getCachedEventsWindow<T extends ChatEvent>(db: Database, eventIndexRange: IndexRange, chatId: string, messageIndex: number): Promise<[EventsSuccessResult<T>, Set<number>, boolean]>;
export declare function getCachedMessageByIndex<T extends ChatEvent>(db: Database, eventIndex: number, chatId: string, threadRootMessageIndex?: number): Promise<EventWrapper<T> | undefined>;
export declare function getCachedEventsByIndex<T extends ChatEvent>(db: Database, eventIndexes: number[], chatId: string, threadRootMessageIndex?: number): Promise<[EventsSuccessResult<T>, Set<number>]>;
export declare function getCachedEvents<T extends ChatEvent>(db: Database, eventIndexRange: IndexRange, chatId: string, startIndex: number, ascending: boolean, threadRootMessageIndex?: number): Promise<[EventsSuccessResult<T>, Set<number>]>;
export declare function mergeSuccessResponses<T extends ChatEvent>(a: EventsSuccessResult<T>, b: EventsSuccessResult<T>): EventsSuccessResult<T>;
export declare function setCachedEvents<T extends ChatEvent>(db: Database, chatId: string, resp: EventsResponse<T>, threadRootMessageIndex?: number): Promise<void>;
export declare function setCachedMessageFromSendResponse(db: Database, chatId: string, threadRootMessageIndex?: number): ([resp, message]: [SendMessageResponse, Message]) => [SendMessageResponse, Message];
export declare function setCachedMessageFromNotification(chatId: string, threadRootMessageIndex: number | undefined, message: EventWrapper<Message>): void;
export declare function getCachedGroupDetails(db: Database, chatId: string): Promise<GroupChatDetails | undefined>;
export declare function setCachedGroupDetails(db: Database, chatId: string, groupDetails: GroupChatDetails): Promise<void>;
export declare function storeSoftDisabled(value: boolean): Promise<void>;
export declare function getSoftDisabled(): Promise<boolean>;
export declare function getDb(): Database | undefined;
export declare function initDb(principal: string): Database | undefined;
export declare function closeDb(): void;
export declare function loadMessagesByMessageIndex(db: Database, chatId: string, messagesIndexes: Set<number>): Promise<{
    messageEvents: EventWrapper<Message>[];
    missing: Set<number>;
}>;
export {};
