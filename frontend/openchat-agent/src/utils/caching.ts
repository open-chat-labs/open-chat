import { MAX_EVENTS } from "../constants";
import { openDB, DBSchema, IDBPDatabase } from "idb";
import {
    ChatEvent,
    ChatSummary,
    EventsResponse,
    EventsSuccessResult,
    EventWrapper,
    GroupChatDetails,
    IndexRange,
    MergedUpdatesResponse,
    Message,
    MessageContent,
    ReplyContext,
    SendMessageResponse,
    SendMessageSuccess,
    UnsupportedValueError,
} from "openchat-shared";

const CACHE_VERSION = 47;

export type Database = Promise<IDBPDatabase<ChatSchema>>;

type EnhancedWrapper<T extends ChatEvent> = EventWrapper<T> & {
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

function padMessageIndex(i: number): string {
    return i.toString().padStart(10, "0");
}

export function createCacheKey(
    chatId: string,
    index: number,
    threadRootMessageIndex?: number
): string {
    return threadRootMessageIndex === undefined
        ? `${chatId}_${padMessageIndex(index)}`
        : `${chatId}_${threadRootMessageIndex}_${padMessageIndex(index)}`;
}

export function openCache(principal: string): Database {
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
            const chatEvents = db.createObjectStore("chat_events");
            chatEvents.createIndex("messageIdx", "messageKey");
            const threadEvents = db.createObjectStore("thread_events");
            threadEvents.createIndex("messageIdx", "messageKey");
            db.createObjectStore("chats");
            db.createObjectStore("group_details");
            if (!db.objectStoreNames.contains("soft_disabled")) {
                db.createObjectStore("soft_disabled");
            }
        },
    });
}

export async function removeCachedChat(
    db: Database,
    userId: string,
    chatId: string
): Promise<void> {
    const fromCache = await getCachedChats(db, userId);
    if (fromCache !== undefined) {
        fromCache.chatSummaries = fromCache.chatSummaries.filter((c) => c.chatId !== chatId);
        await setCachedChats(db, userId, fromCache);
    }
}

export async function openDbAndGetCachedChats(
    principal: string
): Promise<MergedUpdatesResponse | undefined> {
    const db = openCache(principal);
    if (db !== undefined) {
        return getCachedChats(db, principal);
    }
}

export async function getCachedChats(
    db: Database,
    userId: string
): Promise<MergedUpdatesResponse | undefined> {
    return await (await db).get("chats", userId);
}

function isPreviewing(chat: ChatSummary): boolean {
    return chat.kind === "group_chat" && chat.myRole === "previewer";
}

export async function setCachedChats(
    db: Database,
    userId: string,
    data: MergedUpdatesResponse
): Promise<void> {
    if (!data.wasUpdated) {
        return;
    }

    const latestMessages: Record<string, EnhancedWrapper<Message>> = {};

    // irritating hoop jumping to keep typescript happy here
    const chatSummaries = data.chatSummaries
        .filter((c) => !isPreviewing(c))
        .map((c) => {
            const latestMessage = c.latestMessage
                ? makeSerialisable(c.latestMessage, c.chatId)
                : undefined;

            if (latestMessage) {
                latestMessages[c.chatId] = {
                    ...latestMessage,
                    chatId: c.chatId,
                    messageKey: createCacheKey(c.chatId, latestMessage.event.messageIndex),
                };
            }

            if (c.kind === "direct_chat") {
                return {
                    ...c,
                    latestMessage,
                };
            }

            if (c.kind === "group_chat") {
                return {
                    ...c,
                    latestMessage,
                };
            }

            throw new UnsupportedValueError("Unrecognised chat type", c);
        });

    const tx = (await db).transaction(["chats", "chat_events"], "readwrite");
    const chatsStore = tx.objectStore("chats");
    const eventStore = tx.objectStore("chat_events");

    const promises: Promise<string | void>[] = [
        chatsStore.put(
            {
                wasUpdated: true,
                chatSummaries,
                timestamp: data.timestamp,
                blockedUsers: data.blockedUsers,
                pinnedChats: data.pinnedChats,
                avatarIdUpdate: undefined,
                affectedEvents: {},
            },
            userId
        ),
        ...Object.entries(latestMessages).flatMap(([chatId, message]) => [
            eventStore.put(message, createCacheKey(chatId, message.index)),
        ]),
        ...Object.entries(data.affectedEvents)
            .flatMap(([chatId, indexes]) => indexes.map((i) => createCacheKey(chatId, i)))
            .map((key) => eventStore.delete(key)),
    ];

    await Promise.all(promises);
    await tx.done;
}

export async function getCachedEventsWindow<T extends ChatEvent>(
    db: Database,
    eventIndexRange: IndexRange,
    chatId: string,
    messageIndex: number
): Promise<[EventsSuccessResult<T>, Set<number>, boolean]> {
    console.log("cache: window: ", eventIndexRange, messageIndex);
    const start = Date.now();
    const [events, missing, totalMiss] = await aggregateEventsWindow<T>(
        db,
        eventIndexRange,
        chatId,
        messageIndex
    );

    if (!totalMiss && missing.size === 0) {
        console.log("cache hit: ", events.length, Date.now() - start);
    }

    events.sort((a, b) => a.index - b.index);

    return [{ events, affectedEvents: [], latestEventIndex: undefined }, missing, totalMiss];
}

async function aggregateEventsWindow<T extends ChatEvent>(
    db: Database,
    [min, max]: IndexRange,
    chatId: string,
    middleMessageIndex: number
): Promise<[EventWrapper<T>[], Set<number>, boolean]> {
    const events: EventWrapper<T>[] = [];
    const resolvedDb = await db;
    const missing = new Set<number>();

    const middleEvent = await resolvedDb.getFromIndex(
        "chat_events",
        "messageIdx",
        createCacheKey(chatId, middleMessageIndex)
    );
    const midpoint = middleEvent?.index;

    if (midpoint === undefined) {
        console.log(
            "cache total miss: could not even find the starting event index for the message window"
        );
        return [[], missing, true];
    }

    const half = MAX_EVENTS / 2;
    const lowerBound = Math.max(min, midpoint - half);
    const upperBound = Math.min(max, midpoint + half);

    console.log("aggregate events window: events from ", lowerBound, " to ", upperBound);

    const range = IDBKeyRange.bound(
        createCacheKey(chatId, lowerBound),
        createCacheKey(chatId, upperBound)
    );

    for (let i = lowerBound; i <= upperBound; i++) {
        missing.add(i);
    }

    const result = await resolvedDb.getAll("chat_events", range);
    result.forEach((evt) => {
        missing.delete(evt.index);
        events.push(evt as EnhancedWrapper<T>);
    });

    console.log("aggregate events window: missing indexes: ", missing);

    return [events, missing, false];
}

async function aggregateEvents<T extends ChatEvent>(
    db: Database,
    [min, max]: IndexRange,
    chatId: string,
    startIndex: number,
    ascending: boolean,
    threadRootMessageIndex?: number
): Promise<[EnhancedWrapper<T>[], Set<number>]> {
    const events: EnhancedWrapper<T>[] = [];
    const resolvedDb = await db;
    const missing = new Set<number>();

    const lowerBound = ascending ? startIndex : Math.max(min, startIndex - MAX_EVENTS);
    const upperBound = ascending ? Math.min(max, startIndex + MAX_EVENTS) : startIndex;

    const range = IDBKeyRange.bound(
        createCacheKey(chatId, lowerBound, threadRootMessageIndex),
        createCacheKey(chatId, upperBound, threadRootMessageIndex)
    );

    for (let i = lowerBound; i <= upperBound; i++) {
        missing.add(i);
    }

    const store = threadRootMessageIndex === undefined ? "chat_events" : "thread_events";

    const result = await resolvedDb.getAll(store, range);
    result.forEach((evt) => {
        missing.delete(evt.index);
        events.push(evt as EnhancedWrapper<T>);
    });

    console.log("aggregate events: missing indexes: ", missing);
    return [events, missing];
}

export async function getCachedMessageByIndex<T extends ChatEvent>(
    db: Database,
    eventIndex: number,
    chatId: string,
    threadRootMessageIndex?: number
): Promise<EventWrapper<T> | undefined> {
    const key = createCacheKey(chatId, eventIndex, threadRootMessageIndex);
    const store = threadRootMessageIndex !== undefined ? "thread_events" : "chat_events";
    return (await db).get(store, key) as Promise<EventWrapper<T> | undefined>;
}

export async function getCachedEventsByIndex<T extends ChatEvent>(
    db: Database,
    eventIndexes: number[],
    chatId: string,
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
    return [{ events, affectedEvents: [], latestEventIndex: undefined }, missing];
}

export async function getCachedEvents<T extends ChatEvent>(
    db: Database,
    eventIndexRange: IndexRange,
    chatId: string,
    startIndex: number,
    ascending: boolean,
    threadRootMessageIndex?: number
): Promise<[EventsSuccessResult<T>, Set<number>]> {
    console.log("cache: ", eventIndexRange, startIndex, ascending);
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
        console.log("cache hit: ", events.length, Date.now() - start);
    } else {
        console.log("cache miss: ", missing);
    }

    return [{ events, affectedEvents: [], latestEventIndex: undefined }, missing];
}

export function mergeSuccessResponses<T extends ChatEvent>(
    a: EventsSuccessResult<T>,
    b: EventsSuccessResult<T>
): EventsSuccessResult<T> {
    return {
        events: [...a.events, ...b.events].sort((a, b) => a.index - b.index),
        affectedEvents: [...a.affectedEvents, ...b.affectedEvents],
        latestEventIndex:
            a.latestEventIndex === undefined && b.latestEventIndex === undefined
                ? undefined
                : Math.max(a.latestEventIndex ?? -1, b.latestEventIndex ?? -1),
    };
}

// we need to strip out the blobData promise from any media content because that cannot be serialised
function makeSerialisable<T extends ChatEvent>(
    ev: EventWrapper<T>,
    chatId: string,
    threadRootMessageIndex?: number
): EnhancedWrapper<T> {
    if (ev.event.kind !== "message") return { ...ev, chatId, messageKey: undefined };

    return {
        ...ev,
        chatId,
        messageKey: createCacheKey(chatId, ev.event.messageIndex, threadRootMessageIndex),
        event: {
            ...ev.event,
            content: removeBlobData(ev.event.content),
            repliesTo: removeReplyContent(ev.event.repliesTo, chatId),
        },
    };
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
    chatId: string
): ReplyContext | undefined {
    if (repliesTo?.kind === "rehydrated_reply_context") {
        return {
            kind: "raw_reply_context",
            chatIdIfOther: repliesTo.chatId === chatId ? undefined : repliesTo.chatId,
            eventIndex: repliesTo.eventIndex,
        };
    }
    return repliesTo;
}

export async function setCachedEvents<T extends ChatEvent>(
    db: Database,
    chatId: string,
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
        resp.events.concat(resp.affectedEvents).map(async (event) => {
            await eventStore.put(
                makeSerialisable<T>(event, chatId),
                createCacheKey(chatId, event.index, threadRootMessageIndex)
            );
        })
    );
    await tx.done;
}

export function setCachedMessageFromSendResponse(
    db: Database,
    chatId: string,
    threadRootMessageIndex?: number
): ([resp, message]: [SendMessageResponse, Message]) => [SendMessageResponse, Message] {
    return ([resp, message]: [SendMessageResponse, Message]) => {
        if (resp.kind !== "success") return [resp, message];

        const event = messageToEvent(message, resp);

        setCachedMessageIfNotExists(db, chatId, event, threadRootMessageIndex);

        return [resp, message];
    };
}

export function setCachedMessageFromNotification(
    chatId: string,
    threadRootMessageIndex: number | undefined,
    message: EventWrapper<Message>
): void {
    if (db === undefined) {
        throw new Error("Unable to open indexDB, cannot set message from notification");
    }

    setCachedMessageIfNotExists(db, chatId, message, threadRootMessageIndex);
}

async function setCachedMessageIfNotExists(
    db: Database,
    chatId: string,
    messageEvent: EventWrapper<Message>,
    threadRootMessageIndex?: number
): Promise<void> {
    const key = createCacheKey(chatId, messageEvent.index, threadRootMessageIndex);
    const store = threadRootMessageIndex !== undefined ? "thread_events" : "chat_events";
    const tx = (await db).transaction([store], "readwrite", {
        durability: "relaxed",
    });
    const eventStore = tx.objectStore(store);
    if ((await eventStore.count(key)) === 0) {
        await eventStore.add(makeSerialisable(messageEvent, chatId), key);
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

export async function getCachedGroupDetails(
    db: Database,
    chatId: string
): Promise<GroupChatDetails | undefined> {
    return (await db).get("group_details", chatId);
}

export async function setCachedGroupDetails(
    db: Database,
    chatId: string,
    groupDetails: GroupChatDetails
): Promise<void> {
    await (await db).put("group_details", groupDetails, chatId);
}

export async function storeSoftDisabled(value: boolean): Promise<void> {
    if (db !== undefined) {
        await (await db).put("soft_disabled", value, "soft_disabled");
    }
}

export async function getSoftDisabled(): Promise<boolean> {
    if (db !== undefined) {
        const res = await (await db).get("soft_disabled", "soft_disabled");
        return res ?? false;
    }
    return false;
}

let db: Database | undefined;

export function getDb(): Database | undefined {
    return db;
}

export function initDb(principal: string): Database {
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
    chatId: string,
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
                createCacheKey(chatId, msgIdx)
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
