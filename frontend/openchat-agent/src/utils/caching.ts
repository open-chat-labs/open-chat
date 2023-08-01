import { MAX_EVENTS, MAX_MESSAGES } from "../constants";
import { openDB, DBSchema, IDBPDatabase } from "idb";
import {
    chatIdentifiersEqual,
    type ChatEvent,
    type ChatIdentifier,
    type ChatStateFull,
    type ChatSummary,
    type EventsResponse,
    type EventsSuccessResult,
    type EventWrapper,
    type GroupChatDetails,
    type IndexRange,
    type Message,
    type MessageContent,
    type ReplyContext,
    type SendMessageResponse,
    type SendMessageSuccess,
    type UpdatedEvent,
    ChatMap,
    UnsupportedValueError,
    MessageContext,
    MessageContextMap,
    CommunityDetails,
} from "openchat-shared";
import type { Principal } from "@dfinity/principal";
import { toRecord } from "./list";

const CACHE_VERSION = 75;

export type Database = Promise<IDBPDatabase<ChatSchema>>;

type EnhancedWrapper<T extends ChatEvent> = EventWrapper<T> & {
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
        ? chatIdentiferToString(chatId)
        : `${chatIdentiferToString(chatId)}_${threadRootMessageIndex}`;
}

export function createCacheKey(context: MessageContext, index: number): string {
    return `${messageContextToString(context)}_${padMessageIndex(index)}`;
}

function chatIdentiferToString(chatId: ChatIdentifier): string {
    if (chatId.kind === "channel") {
        return `${chatId.communityId}_${chatId.channelId}`;
    }
    if (chatId.kind === "direct_chat") {
        return chatId.userId;
    }
    if (chatId.kind === "group_chat") {
        return chatId.groupId;
    }
    throw new UnsupportedValueError("Unknown chatId kind", chatId);
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
            const chatEvents = db.createObjectStore("chat_events");
            chatEvents.createIndex("messageIdx", "messageKey");
            const threadEvents = db.createObjectStore("thread_events");
            threadEvents.createIndex("messageIdx", "messageKey");
            db.createObjectStore("chats");
            db.createObjectStore("group_details");
            db.createObjectStore("community_details");
            db.createObjectStore("failed_chat_messages");
            db.createObjectStore("failed_thread_messages");
        },
    });
}

export async function openDbAndGetCachedChats(
    principal: Principal
): Promise<ChatStateFull | undefined> {
    const db = openCache(principal);
    if (db !== undefined) {
        return getCachedChats(db, principal);
    }
}

export async function getCachedChats(
    db: Database,
    principal: Principal
): Promise<ChatStateFull | undefined> {
    return await (await db).get("chats", principal.toString());
}

export async function setCachedChats(
    db: Database,
    principal: Principal,
    chatState: ChatStateFull,
    updatedEvents: ChatMap<UpdatedEvent[]>
): Promise<void> {
    const directChats = chatState.directChats.map(makeChatSummarySerializable);
    const groupChats = chatState.groupChats.map(makeChatSummarySerializable);

    const stateToCache = {
        ...chatState,
        directChats,
        groupChats,
    };

    const tx = (await db).transaction(["chats", "chat_events", "thread_events"], "readwrite");
    const chatsStore = tx.objectStore("chats");
    const eventsStore = tx.objectStore("chat_events");
    const threadsStore = tx.objectStore("thread_events");

    const deleteRequests = updatedEvents.entries().flatMap(([chatId, indexes]) => {
        return indexes.map((i) => {
            const key = createCacheKey(
                { chatId, threadRootMessageIndex: i.threadRootMessageIndex },
                i.eventIndex
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

export async function getCachedEventsWindow<T extends ChatEvent>(
    db: Database,
    eventIndexRange: IndexRange,
    chatId: ChatIdentifier,
    messageIndex: number,
    threadRootMessageIndex?: number
): Promise<[EventsSuccessResult<T>, Set<number>, boolean]> {
    console.debug("CACHE: window: ", eventIndexRange, messageIndex);
    const start = Date.now();
    const [events, missing, totalMiss] = await aggregateEventsWindow<T>(
        db,
        eventIndexRange,
        chatId,
        messageIndex,
        threadRootMessageIndex
    );

    if (!totalMiss && missing.size === 0) {
        console.debug("CACHE: hit: ", events.length, Date.now() - start);
    }

    return [{ events, latestEventIndex: undefined }, missing, totalMiss];
}

async function aggregateEventsWindow<T extends ChatEvent>(
    db: Database,
    [min, max]: IndexRange,
    chatId: ChatIdentifier,
    middleMessageIndex: number,
    threadRootMessageIndex?: number
): Promise<[EventWrapper<T>[], Set<number>, boolean]> {
    const resolvedDb = await db;

    const store = threadRootMessageIndex === undefined ? "chat_events" : "thread_events";

    const middleEvent = await resolvedDb.getFromIndex(
        store,
        "messageIdx",
        createCacheKey({ chatId, threadRootMessageIndex }, middleMessageIndex)
    );
    const midpoint = middleEvent?.index;

    if (midpoint === undefined) {
        console.debug(
            "CACHE: total miss: could not even find the starting event index for the message window"
        );
        return [[], new Set<number>(), true];
    }

    if (min > midpoint) {
        min = midpoint;
    }
    if (max < midpoint) {
        max = midpoint;
    }

    const half = MAX_EVENTS / 2;
    const lowerBound = Math.max(min, midpoint - half);
    const upperBound = Math.min(max, midpoint + half);

    console.debug("CACHE: aggregate events window: events from ", lowerBound, " to ", upperBound);

    const range = IDBKeyRange.bound(
        createCacheKey({ chatId, threadRootMessageIndex }, lowerBound),
        createCacheKey({ chatId, threadRootMessageIndex }, upperBound)
    );

    const result = await resolvedDb.getAll(store, range);

    return processCachedEventsWindow(lowerBound, upperBound, midpoint, result, MAX_MESSAGES) as [
        EventWrapper<T>[],
        Set<number>,
        boolean
    ];
}

export function processCachedEventsWindow(
    lowerbound: number,
    upperbound: number,
    midpoint: number,
    cachedEvents: { index: number; event: { kind: string } }[],
    maxMessages: number = MAX_MESSAGES
): [{ index: number; event: { kind: string } }[], Set<number>, false] {
    const events: { index: number; event: { kind: string } }[] = [];
    const missing = new Set<number>();
    let messageCount = 0;

    const cachedEventsMap = toRecord(cachedEvents, (evt) => evt.index);

    function inBounds(idx: number): boolean {
        return idx >= lowerbound && idx <= upperbound;
    }

    function processIndex(idx: number) {
        const cachedEvent = cachedEventsMap[idx];
        if (cachedEvent === undefined) {
            if (inBounds(idx)) {
                missing.add(idx);
            }
        } else {
            if (cachedEvent.event.kind === "message") {
                messageCount += 1;
            }
            events.push(cachedEvent);
        }
    }

    function loop(forwardIndex: number, backwardIndex: number): undefined {
        processIndex(forwardIndex);
        processIndex(backwardIndex);
        if (messageCount < maxMessages) {
            if (forwardIndex < upperbound || backwardIndex > lowerbound) {
                return loop(forwardIndex + 1, backwardIndex - 1);
            }
        }
    }

    loop(midpoint, midpoint - 1);

    return [events.sort((a, b) => a.index - b.index), missing, false];
}

// why is this extracted like this with slightly odd looking types?
// to make it easier to unit test
export function processCachedEvents(
    lowerbound: number,
    upperbound: number,
    ascending: boolean,
    cachedEvents: { index: number; event: { kind: string } }[],
    maxMessages: number = MAX_MESSAGES
): [{ index: number; event: { kind: string } }[], Set<number>] {
    const events: { index: number; event: { kind: string } }[] = [];
    const missing = new Set<number>();
    let messageCount = 0;

    const cachedEventsMap = toRecord(cachedEvents, (evt) => evt.index);

    function loop(idx: number): undefined {
        const cachedEvent = cachedEventsMap[idx];
        if (cachedEvent === undefined) {
            missing.add(idx);
        } else {
            if (cachedEvent.event.kind === "message") {
                messageCount += 1;
            }
            events.push(cachedEvent);
        }
        if (messageCount < maxMessages) {
            if (ascending ? idx < upperbound : idx > lowerbound) {
                return loop(ascending ? idx + 1 : idx - 1);
            }
        }
    }

    loop(ascending ? lowerbound : upperbound);

    return [events.sort((a, b) => a.index - b.index), missing];
}

async function aggregateEvents<T extends ChatEvent>(
    db: Database,
    [min, max]: IndexRange,
    chatId: ChatIdentifier,
    startIndex: number,
    ascending: boolean,
    threadRootMessageIndex?: number
): Promise<[EnhancedWrapper<T>[], Set<number>]> {
    const resolvedDb = await db;
    const lowerBound = ascending ? startIndex : Math.max(min, startIndex - MAX_EVENTS);
    const upperBound = ascending ? Math.min(max, startIndex + MAX_EVENTS) : startIndex;

    const range = IDBKeyRange.bound(
        createCacheKey({ chatId, threadRootMessageIndex }, lowerBound),
        createCacheKey({ chatId, threadRootMessageIndex }, upperBound)
    );

    const store = threadRootMessageIndex === undefined ? "chat_events" : "thread_events";

    const result = await resolvedDb.getAll(store, range);

    return processCachedEvents(lowerBound, upperBound, ascending, result) as [
        EnhancedWrapper<T>[],
        Set<number>
    ];
}

export async function getCachedMessageByIndex<T extends ChatEvent>(
    db: Database,
    eventIndex: number,
    chatId: ChatIdentifier,
    threadRootMessageIndex?: number
): Promise<EventWrapper<T> | undefined> {
    const key = createCacheKey({ chatId, threadRootMessageIndex }, eventIndex);
    const store = threadRootMessageIndex !== undefined ? "thread_events" : "chat_events";
    return (await db).get(store, key) as Promise<EventWrapper<T> | undefined>;
}

export async function getCachedEventsByIndex<T extends ChatEvent>(
    db: Database,
    eventIndexes: number[],
    chatId: ChatIdentifier,
    threadRootMessageIndex?: number
): Promise<[EventsSuccessResult<T>, Set<number>]> {
    const missing = new Set<number>();
    const returnedEvents = await Promise.all(
        eventIndexes.map((idx) => {
            return getCachedMessageByIndex(db, idx, chatId, threadRootMessageIndex).then((evt) => {
                if (evt === undefined) {
                    missing.add(idx);
                }
                return evt;
            });
        })
    );
    const events = returnedEvents.filter((evt) => evt !== undefined) as EventWrapper<T>[];
    return [{ events, latestEventIndex: undefined }, missing];
}

export async function getCachedEvents<T extends ChatEvent>(
    db: Database,
    eventIndexRange: IndexRange,
    chatId: ChatIdentifier,
    startIndex: number,
    ascending: boolean,
    threadRootMessageIndex?: number
): Promise<[EventsSuccessResult<T>, Set<number>]> {
    console.debug("CACHE: ", eventIndexRange, startIndex, ascending);
    const start = Date.now();
    const [events, missing] = await aggregateEvents<T>(
        db,
        eventIndexRange,
        chatId,
        startIndex,
        ascending,
        threadRootMessageIndex
    );

    if (missing.size === 0) {
        console.debug("CACHE: hit: ", events.length, Date.now() - start);
    } else {
        console.debug("CACHE: miss: ", missing);
    }

    return [{ events, latestEventIndex: undefined }, missing];
}

export function mergeSuccessResponses<T extends ChatEvent>(
    a: EventsSuccessResult<T>,
    b: EventsSuccessResult<T>
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
    threadRootMessageIndex?: number
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

function removeBlobData(content: MessageContent): MessageContent {
    if ("blobData" in content) {
        return {
            ...content,
            blobData: undefined,
        };
    }
    return content;
}

function removeReplyContent(
    repliesTo: ReplyContext | undefined,
    chatId: ChatIdentifier
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
    threadRootMessageIndex?: number
): Promise<void> {
    const store =
        threadRootMessageIndex !== undefined ? "failed_thread_messages" : "failed_chat_messages";
    (await db).delete(store, createFailedCacheKey({ chatId, threadRootMessageIndex }, messageId));
}

export async function recordFailedMessage<T extends Message>(
    db: Database,
    chatId: ChatIdentifier,
    event: EventWrapper<T>,
    threadRootMessageIndex?: number
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
        key
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
    db: Database
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
    threadRootMessageIndex?: number
): Promise<void> {
    if (resp === "events_failed") return;
    const store = threadRootMessageIndex !== undefined ? "thread_events" : "chat_events";

    const tx = (await db).transaction([store], "readwrite", {
        durability: "relaxed",
    });
    const eventStore = tx.objectStore(store);
    await Promise.all(
        resp.events.map(async (event) => {
            await eventStore.put(
                makeSerialisable<T>(event, chatId, true, threadRootMessageIndex),
                createCacheKey({ chatId, threadRootMessageIndex }, event.index)
            );
        })
    );
    await tx.done;
}

export function setCachedMessageFromSendResponse(
    db: Database,
    chatId: ChatIdentifier,
    sentEvent: EventWrapper<Message>,
    threadRootMessageIndex?: number
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
    threadRootMessageIndex?: number
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
            key
        );
    }
    await tx.done;
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
    communityId: string
): Promise<CommunityDetails | undefined> {
    return (await db).get("community_details", communityId);
}

export async function getCachedGroupDetails(
    db: Database,
    chatId: string
): Promise<GroupChatDetails | undefined> {
    return (await db).get("group_details", chatId);
}

export async function setCachedCommunityDetails(
    db: Database,
    communityId: string,
    communityDetails: CommunityDetails
): Promise<void> {
    await (await db).put("community_details", communityDetails, communityId);
}

export async function setCachedGroupDetails(
    db: Database,
    chatId: string,
    groupDetails: GroupChatDetails
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
    messagesIndexes: Set<number>
): Promise<{ messageEvents: EventWrapper<Message>[]; missing: Set<number> }> {
    const resolvedDb = await db;

    const missing: Set<number> = new Set();
    const messages: EventWrapper<Message>[] = [];

    await Promise.all<Message | undefined>(
        [...messagesIndexes].map(async (msgIdx) => {
            const evt = await resolvedDb.getFromIndex(
                "chat_events",
                "messageIdx",
                createCacheKey({ chatId }, msgIdx)
            );
            if (evt?.event.kind === "message") {
                messages.push(evt as EventWrapper<Message>);
                return evt.event;
            }
            missing.add(msgIdx);
            return undefined;
        })
    );

    return {
        messageEvents: messages,
        missing,
    };
}

function makeChatSummarySerializable<T extends ChatSummary>(chat: T): T {
    if (chat.latestMessage === undefined) return chat;

    return {
        ...chat,
        latestMessage: makeSerialisable(chat.latestMessage, chat.id, true),
    };
}
