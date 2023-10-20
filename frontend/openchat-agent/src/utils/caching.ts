import { MAX_EVENTS, MAX_MESSAGES } from "../constants";
import { openDB, type DBSchema, type IDBPDatabase, type StoreNames, type StoreValue } from "idb";
import type {
    ChatEvent,
    ChatIdentifier,
    ChatStateFull,
    ChatSummary,
    EventsResponse,
    EventsSuccessResult,
    EventWrapper,
    GroupChatDetails,
    IndexRange,
    Message,
    MessageContent,
    ReplyContext,
    SendMessageResponse,
    SendMessageSuccess,
    UpdatedEvent,
    MessageContext,
    CommunityDetails,
    CommunitySummary,
    DataContent,
} from "openchat-shared";
import {
    chatIdentifiersEqual,
    chatIdentifierToString,
    ChatMap,
    MessageContextMap,
} from "openchat-shared";
import type { Principal } from "@dfinity/principal";
import { iterateCachedEvents } from "./cachedEventsIterator";

const CACHE_VERSION = 85;

export type Database = Promise<IDBPDatabase<ChatSchema>>;

export type EnhancedWrapper<T extends ChatEvent> = EventWrapper<T> & {
    chatId: ChatIdentifier;
    messageKey: string | undefined;
};

export interface ChatSchema extends DBSchema {
    chats: {
        key: string;
        value: ChatStateFull;
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

    community_details: {
        key: string;
        value: CommunityDetails;
    };

    failed_chat_messages: {
        key: string;
        value: EnhancedWrapper<Message>;
    };

    failed_thread_messages: {
        key: string;
        value: EnhancedWrapper<Message>;
    };

    cachePrimer: {
        key: string;
        value: bigint;
    };
}

function padMessageIndex(i: number): string {
    return i.toString().padStart(10, "0");
}

type FailedCacheKey = MessageContext & { messageId: bigint };

export function createFailedCacheKey(context: MessageContext, messageId: bigint): string {
    return JSON.stringify({
        ...context,
        messageId,
    });
}

function messageContextToString({ chatId, threadRootMessageIndex }: MessageContext): string {
    return threadRootMessageIndex === undefined
        ? chatIdentifierToString(chatId)
        : `${chatIdentifierToString(chatId)}_${threadRootMessageIndex}`;
}

export function createCacheKey(context: MessageContext, index: number): string {
    return `${messageContextToString(context)}_${padMessageIndex(index)}`;
}

export function openCache(principal: Principal): Database {
    return openDB<ChatSchema>(`openchat_db_${principal}`, CACHE_VERSION, {
        upgrade(db, _oldVersion, _newVersion) {
            if (db.objectStoreNames.contains("chat_events")) {
                db.deleteObjectStore("chat_events");
            }
            if (db.objectStoreNames.contains("thread_events")) {
                db.deleteObjectStore("thread_events");
            }
            if (db.objectStoreNames.contains("chats")) {
                db.deleteObjectStore("chats");
            }
            if (db.objectStoreNames.contains("group_details")) {
                db.deleteObjectStore("group_details");
            }
            if (db.objectStoreNames.contains("community_details")) {
                db.deleteObjectStore("community_details");
            }
            if (db.objectStoreNames.contains("failed_chat_messages")) {
                db.deleteObjectStore("failed_chat_messages");
            }
            if (db.objectStoreNames.contains("failed_thread_messages")) {
                db.deleteObjectStore("failed_thread_messages");
            }
            if (db.objectStoreNames.contains("cachePrimer")) {
                db.deleteObjectStore("cachePrimer");
            }
            const chatEvents = db.createObjectStore("chat_events");
            chatEvents.createIndex("messageIdx", "messageKey");
            const threadEvents = db.createObjectStore("thread_events");
            threadEvents.createIndex("messageIdx", "messageKey");
            db.createObjectStore("chats");
            db.createObjectStore("group_details");
            db.createObjectStore("community_details");
            db.createObjectStore("failed_chat_messages");
            db.createObjectStore("failed_thread_messages");
            db.createObjectStore("cachePrimer");
        },
    });
}

export async function openDbAndGetCachedChats(
    principal: Principal,
): Promise<ChatStateFull | undefined> {
    const db = openCache(principal);
    if (db !== undefined) {
        return getCachedChats(db, principal);
    }
}

export async function getCachedChats(
    db: Database,
    principal: Principal,
): Promise<ChatStateFull | undefined> {
    return await (await db).get("chats", principal.toString());
}

export async function setCachedChats(
    db: Database,
    principal: Principal,
    chatState: ChatStateFull,
    updatedEvents: ChatMap<UpdatedEvent[]>,
): Promise<void> {
    const directChats = chatState.directChats.map(makeChatSummarySerializable);
    const groupChats = chatState.groupChats.map(makeChatSummarySerializable);
    const communities = chatState.communities.map(makeCommunitySerializable);

    const stateToCache = {
        ...chatState,
        directChats,
        groupChats,
        communities,
    };

    const tx = (await db).transaction(["chats", "chat_events", "thread_events"], "readwrite");
    const chatsStore = tx.objectStore("chats");
    const eventsStore = tx.objectStore("chat_events");
    const threadsStore = tx.objectStore("thread_events");

    const deleteRequests = updatedEvents.entries().flatMap(([chatId, indexes]) => {
        return indexes.map((i) => {
            const key = createCacheKey(
                { chatId, threadRootMessageIndex: i.threadRootMessageIndex },
                i.eventIndex,
            );
            return i.threadRootMessageIndex === undefined
                ? eventsStore.delete(key)
                : threadsStore.delete(key);
        });
    });

    const promises = [chatsStore.put(stateToCache, principal.toString()), ...deleteRequests];

    await Promise.all(promises);
    await tx.done;
}

export async function getCachedEvents<T extends ChatEvent>(
    db: Database,
    eventIndexRange: IndexRange,
    context: MessageContext,
    startIndex: number,
    ascending: boolean,
    maxEvents = MAX_EVENTS,
    maxMessages = MAX_MESSAGES,
    maxMissing = 50,
): Promise<[EventsSuccessResult<T>, Set<number>]> {
    console.debug("CACHE: ", context, eventIndexRange, startIndex, ascending);
    const start = Date.now();

    const [events, missing] = await iterateCachedEvents(
        await db,
        eventIndexRange,
        context,
        startIndex,
        ascending,
        maxEvents,
        maxMessages,
        maxMissing,
    );

    if (missing.size === 0) {
        console.debug("CACHE: hit: ", events.length, Date.now() - start);
    } else {
        console.debug("CACHE: miss: ", missing);
    }

    return [{ events: events as EventWrapper<T>[], latestEventIndex: undefined }, missing];
}

export async function getCachedEventsWindowByMessageIndex<T extends ChatEvent>(
    db: Database,
    eventIndexRange: IndexRange,
    context: MessageContext,
    messageIndex: number,
    maxEvents = MAX_EVENTS,
    maxMessages = MAX_MESSAGES,
    maxMissing = 50,
): Promise<[EventsSuccessResult<T>, Set<number>, boolean]> {
    const eventIndex = await getCachedEventIndexByMessageIndex(db, context, messageIndex);
    if (eventIndex === undefined) {
        return [{ events: [], latestEventIndex: undefined }, new Set(), true];
    }

    const [events, missing] = await getCachedEventsWindow<T>(
        db,
        eventIndexRange,
        context,
        eventIndex,
        maxEvents,
        maxMessages,
        maxMissing,
    );

    return [events, missing, false];
}

export async function getCachedEventsWindow<T extends ChatEvent>(
    db: Database,
    eventIndexRange: IndexRange,
    context: MessageContext,
    startIndex: number,
    maxEvents = MAX_EVENTS,
    maxMessages = MAX_MESSAGES,
    maxMissing = 50,
): Promise<[EventsSuccessResult<T>, Set<number>]> {
    console.debug("CACHE: window: ", eventIndexRange, startIndex);
    const start = Date.now();
    const resolvedDb = await db;

    const backwardsPromise = iterateCachedEvents(
        resolvedDb,
        eventIndexRange,
        context,
        startIndex - 1,
        false,
        maxEvents / 2,
        maxMessages / 2,
        maxMissing / 2,
    );
    const forwardsPromise = iterateCachedEvents(
        resolvedDb,
        eventIndexRange,
        context,
        startIndex,
        true,
        maxEvents / 2,
        maxMessages / 2,
        maxMissing / 2,
    );

    const [[backwardsEvents, backwardsMissing], [forwardsEvents, forwardsMissing]] =
        await Promise.all([forwardsPromise, backwardsPromise]);

    const events = backwardsEvents.concat(forwardsEvents);
    const missing = new Set([...backwardsMissing, ...forwardsMissing]);

    if (missing.size === 0) {
        console.debug("CACHE: hit: ", events.length, Date.now() - start);
    }

    return [{ events: events as EventWrapper<T>[], latestEventIndex: undefined }, missing];
}

export async function getCachedEventByIndex<T extends ChatEvent>(
    db: IDBPDatabase<ChatSchema>,
    eventIndex: number,
    context: MessageContext,
): Promise<EventWrapper<T> | undefined> {
    const storeName =
        context.threadRootMessageIndex === undefined ? "chat_events" : "thread_events";
    const key = createCacheKey(context, eventIndex);

    const event = await db.get(storeName, IDBKeyRange.lowerBound(key));

    if (event === undefined || event.index === eventIndex) {
        return event as EventWrapper<T> | undefined;
    }
    return undefined;
}

export async function getCachedEventsByIndex<T extends ChatEvent>(
    db: Database,
    eventIndexes: number[],
    context: MessageContext,
): Promise<[EventsSuccessResult<T>, Set<number>]> {
    const resolvedDb = await db;
    const events: EventWrapper<T>[] = [];
    const missing = new Set<number>();
    await Promise.all(
        eventIndexes.map(async (idx) => {
            const evt = await getCachedEventByIndex(resolvedDb, idx, context);
            if (evt !== undefined) {
                events.push(evt as EventWrapper<T>);
            } else {
                missing.add(idx);
            }
        }),
    );
    return [{ events, latestEventIndex: undefined }, missing];
}

export async function getCachedEventIndexByMessageIndex(
    db: Database,
    context: MessageContext,
    messageIndex: number,
): Promise<number | undefined> {
    const store = context.threadRootMessageIndex !== undefined ? "thread_events" : "chat_events";
    const cacheKey = createCacheKey(context, messageIndex);

    const value = await (
        await db
    ).getFromIndex(store, "messageIdx", IDBKeyRange.lowerBound(cacheKey));

    if (
        value !== undefined &&
        value.event.kind === "message" &&
        value.event.messageIndex === messageIndex
    ) {
        return value.index;
    }
    return undefined;
}

export function mergeSuccessResponses<T extends ChatEvent>(
    a: EventsSuccessResult<T>,
    b: EventsSuccessResult<T>,
): EventsSuccessResult<T> {
    return {
        events: [...a.events, ...b.events].sort((a, b) => a.index - b.index),
        latestEventIndex:
            a.latestEventIndex === undefined && b.latestEventIndex === undefined
                ? undefined
                : Math.max(a.latestEventIndex ?? -1, b.latestEventIndex ?? -1),
    };
}

// we need to strip out the blobData promise from any media content because that cannot be serialised
function makeSerialisable<T extends ChatEvent>(
    ev: EventWrapper<T>,
    chatId: ChatIdentifier,
    removeBlobs: boolean,
    threadRootMessageIndex?: number,
): EnhancedWrapper<T> {
    if (ev.event.kind !== "message") return { ...ev, chatId: { ...chatId }, messageKey: undefined };

    return {
        ...ev,
        chatId: { ...chatId },
        messageKey: createCacheKey({ chatId, threadRootMessageIndex }, ev.event.messageIndex),
        event: {
            ...ev.event,
            content: removeBlobs ? removeBlobData(ev.event.content) : ev.event.content,
            repliesTo: removeReplyContent(ev.event.repliesTo, chatId),
        },
    };
}

function dataToBlobUrl(data: Uint8Array, type?: string): string {
    const options = type ? { type } : undefined;
    const blob = new Blob([data], options);
    return URL.createObjectURL(blob);
}

function removeBlobData<T extends MessageContent | DataContent>(content: T): T {
    if ("blobData" in content && content.blobData !== undefined) {
        return {
            ...content,
            blobData: undefined,
        };
    }
    return content;
}

function removeReplyContent(
    repliesTo: ReplyContext | undefined,
    chatId: ChatIdentifier,
): ReplyContext | undefined {
    if (repliesTo?.kind === "rehydrated_reply_context") {
        return {
            kind: "raw_reply_context",
            sourceContext: chatIdentifiersEqual(repliesTo.sourceContext.chatId, chatId)
                ? undefined
                : repliesTo.sourceContext,
            eventIndex: repliesTo.eventIndex,
        };
    }
    return repliesTo;
}

export async function removeFailedMessage(
    db: Database,
    chatId: ChatIdentifier,
    messageId: bigint,
    threadRootMessageIndex?: number,
): Promise<void> {
    const store =
        threadRootMessageIndex !== undefined ? "failed_thread_messages" : "failed_chat_messages";
    (await db).delete(store, createFailedCacheKey({ chatId, threadRootMessageIndex }, messageId));
}

export async function recordFailedMessage<T extends Message>(
    db: Database,
    chatId: ChatIdentifier,
    event: EventWrapper<T>,
    threadRootMessageIndex?: number,
): Promise<void> {
    const store =
        threadRootMessageIndex !== undefined ? "failed_thread_messages" : "failed_chat_messages";
    const key = createFailedCacheKey({ chatId, threadRootMessageIndex }, event.event.messageId);
    (await db).put(
        store,
        {
            ...makeSerialisable<T>(event, chatId, false, threadRootMessageIndex),
            messageKey: key,
        },
        key,
    );
}

function rebuildBlobUrls(content: MessageContent): MessageContent {
    if (
        (content.kind === "image_content" ||
            content.kind === "file_content" ||
            content.kind === "audio_content") &&
        content.blobData !== undefined
    ) {
        content.blobUrl = dataToBlobUrl(content.blobData);
    }
    if (content.kind === "video_content") {
        if (content.imageData.blobData !== undefined) {
            content.imageData.blobUrl = dataToBlobUrl(content.imageData.blobData);
        }
        if (content.videoData.blobData !== undefined) {
            content.videoData.blobUrl = dataToBlobUrl(content.videoData.blobData);
        }
    }
    return content;
}

export async function loadFailedMessages(
    db: Database,
): Promise<MessageContextMap<Record<number, EventWrapper<Message>>>> {
    const chatMessages = await (await db).getAll("failed_chat_messages");
    const threadMessages = await (await db).getAll("failed_thread_messages");
    return [...chatMessages, ...threadMessages].reduce((res, ev) => {
        if (ev.messageKey === undefined) return res;
        const parsedKey = JSON.parse(ev.messageKey) as FailedCacheKey;
        const context = {
            chatId: parsedKey.chatId,
            threadRootMessageIndex: parsedKey.threadRootMessageIndex,
        };
        const val = res.get(context) ?? {};
        ev.event.content = rebuildBlobUrls(ev.event.content);
        val[Number(ev.event.messageId)] = ev;
        res.set(context, val);
        return res;
    }, new MessageContextMap<Record<number, EventWrapper<Message>>>());
}

export async function setCachedEvents<T extends ChatEvent>(
    db: Database,
    chatId: ChatIdentifier,
    resp: EventsResponse<T>,
    threadRootMessageIndex: number | undefined,
): Promise<void> {
    if (resp === "events_failed") return;
    const store = threadRootMessageIndex !== undefined ? "thread_events" : "chat_events";

    const tx = (await db).transaction([store], "readwrite", {
        durability: "relaxed",
    });
    const eventStore = tx.objectStore(store);
    await Promise.all(
        resp.events.map((event) => {
            eventStore.put(
                makeSerialisable<T>(event, chatId, true, threadRootMessageIndex),
                createCacheKey({ chatId, threadRootMessageIndex }, event.index),
            );
        }),
    );
    await tx.done;
}

export function setCachedMessageFromSendResponse(
    db: Database,
    chatId: ChatIdentifier,
    sentEvent: EventWrapper<Message>,
    threadRootMessageIndex?: number,
): ([resp, message]: [SendMessageResponse, Message]) => [SendMessageResponse, Message] {
    return ([resp, message]: [SendMessageResponse, Message]) => {
        if (resp.kind !== "success") {
            recordFailedMessage(db, chatId, sentEvent, threadRootMessageIndex);
            return [resp, message];
        }

        const event = messageToEvent(message, resp);

        setCachedMessageIfNotExists(db, chatId, event, threadRootMessageIndex);

        return [resp, message];
    };
}

export async function setCachedMessageIfNotExists(
    db: Database,
    chatId: ChatIdentifier,
    messageEvent: EventWrapper<Message>,
    threadRootMessageIndex?: number,
): Promise<void> {
    const key = createCacheKey({ chatId, threadRootMessageIndex }, messageEvent.index);
    const store = threadRootMessageIndex !== undefined ? "thread_events" : "chat_events";
    const tx = (await db).transaction([store], "readwrite", {
        durability: "relaxed",
    });
    const eventStore = tx.objectStore(store);
    if ((await eventStore.count(key)) === 0) {
        await eventStore.add(
            makeSerialisable(messageEvent, chatId, true, threadRootMessageIndex),
            key,
        );
    }
    await tx.done;
}

export function getCachePrimerTimestamps(db: Database): Promise<Record<string, bigint>> {
    return readAll(db, "cachePrimer");
}

export async function setCachePrimerTimestamp(
    db: Database,
    chatIdentifierString: string,
    timestamp: bigint,
): Promise<void> {
    await (await db).put("cachePrimer", timestamp, chatIdentifierString);
}

function messageToEvent(message: Message, resp: SendMessageSuccess): EventWrapper<Message> {
    return {
        event: {
            ...message,
            messageIndex: resp.messageIndex,
        },
        index: resp.eventIndex,
        timestamp: resp.timestamp,
    };
}

export async function getCachedCommunityDetails(
    db: Database,
    communityId: string,
): Promise<CommunityDetails | undefined> {
    return (await db).get("community_details", communityId);
}

export async function getCachedGroupDetails(
    db: Database,
    chatId: string,
): Promise<GroupChatDetails | undefined> {
    return (await db).get("group_details", chatId);
}

export async function setCachedCommunityDetails(
    db: Database,
    communityId: string,
    communityDetails: CommunityDetails,
): Promise<void> {
    await (await db).put("community_details", communityDetails, communityId);
}

export async function setCachedGroupDetails(
    db: Database,
    chatId: string,
    groupDetails: GroupChatDetails,
): Promise<void> {
    await (await db).put("group_details", groupDetails, chatId);
}

let db: Database | undefined;

export function getDb(): Database | undefined {
    return db;
}

export function initDb(principal: Principal): Database {
    db = openCache(principal);
    return db;
}

export function closeDb(): void {
    db = undefined;
}

// for now this is only used for loading pinned messages so we can ignore the idea of
// thread root message index, but it might come up later
export async function loadMessagesByMessageIndex(
    db: Database,
    chatId: ChatIdentifier,
    messagesIndexes: Set<number>,
): Promise<{ messageEvents: EventWrapper<Message>[]; missing: Set<number> }> {
    const resolvedDb = await db;

    const missing: Set<number> = new Set();
    const messages: EventWrapper<Message>[] = [];

    await Promise.all<Message | undefined>(
        [...messagesIndexes].map(async (msgIdx) => {
            const evt = await resolvedDb.getFromIndex(
                "chat_events",
                "messageIdx",
                createCacheKey({ chatId }, msgIdx),
            );
            if (evt?.event.kind === "message") {
                messages.push(evt as EventWrapper<Message>);
                return evt.event;
            }
            missing.add(msgIdx);
            return undefined;
        }),
    );

    return {
        messageEvents: messages,
        missing,
    };
}

function makeCommunitySerializable(community: CommunitySummary): CommunitySummary {
    const channels = community.channels.map(makeChatSummarySerializable);
    const avatar = removeBlobData(community.avatar);
    const banner = removeBlobData(community.banner);

    return {
        ...community,
        channels,
        avatar,
        banner,
    };
}

function makeChatSummarySerializable<T extends ChatSummary>(chat: T): T {
    if (chat.latestMessage === undefined) return chat;

    return {
        ...chat,
        latestMessage: makeSerialisable(chat.latestMessage, chat.id, true),
    };
}

async function readAll<Name extends StoreNames<ChatSchema>>(
    db: Database,
    storeName: Name,
): Promise<Record<string, StoreValue<ChatSchema, Name>>> {
    const transaction = (await db).transaction([storeName]);
    const store = transaction.objectStore(storeName);
    const cursor = await store.openCursor();
    const values: Record<string, StoreValue<ChatSchema, Name>> = {};
    while (cursor?.key !== undefined) {
        values[cursor.key as string] = cursor.value;
        try {
            await cursor.continue();
        } catch {
            break;
        }
    }
    return values;
}
