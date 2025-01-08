import {
    deleteDB,
    openDB,
    type DBSchema,
    type IDBPCursorWithValue,
    type IDBPDatabase,
    type IDBPTransaction,
    type StoreNames,
    type StoreValue,
} from "idb";
import type {
    ChatEvent,
    ChatIdentifier,
    ChatStateFull,
    ChatSummary,
    EventsResponse,
    EventsSuccessResult,
    EventWrapper,
    ExpiredEventsRange,
    ExpiredMessagesRange,
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
    CreatedUser,
    DiamondMembershipStatus,
    TransferSuccess,
    CurrentUserSummary,
    ExternalAchievement,
    MessageActivityEvent,
    BotsResponse,
} from "openchat-shared";
import {
    canRetryMessage,
    chatIdentifiersEqual,
    chatIdentifierToString,
    ChatMap,
    MessageContextMap,
    MAX_EVENTS,
    MAX_MESSAGES,
    ONE_DAY,
    updateCreatedUser,
} from "openchat-shared";
import type { Principal } from "@dfinity/principal";
import type { CryptocurrencyContent } from "openchat-shared";
import type { PrizeContent } from "openchat-shared";
import type { P2PSwapContent } from "openchat-shared";

const CACHE_VERSION = 122;
const EARLIEST_SUPPORTED_MIGRATION = 115;
const MAX_INDEX = 9999999999;

export type Database = Promise<IDBPDatabase<ChatSchema>>;

export type EnhancedWrapper<T extends ChatEvent> = EventWrapper<T> & {
    kind: "event";
    chatId: ChatIdentifier;
    messageKey: string | undefined;
};

export interface ChatSchema extends DBSchema {
    chats: {
        key: string;
        value: ChatStateFull;
    };

    bots: {
        key: string;
        value: BotsResponse;
    };

    chat_events: {
        key: string;
        value: EnhancedWrapper<ChatEvent> | ExpiredEventsRange;
        indexes: {
            messageIdx: string;
            expiresAt: number;
        };
    };

    thread_events: {
        key: string;
        value: EnhancedWrapper<ChatEvent>;
        indexes: {
            messageIdx: string;
        };
    };

    expiredMessageRanges: {
        key: string;
        value: ExpiredMessagesRange;
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

    currentUser: {
        key: string;
        value: CreatedUser;
    };

    localUserIndex: {
        key: string;
        value: string;
    };

    externalAchievements: {
        key: string;
        value: {
            lastUpdated: bigint;
            achievements: ExternalAchievement[];
        };
    };

    activityFeed: {
        key: string;
        value: MessageActivityEvent[];
    };
}

type MigrationFunction<T> = (
    db: IDBPDatabase<T>,
    principal: Principal,
    transaction: IDBPTransaction<T, StoreNames<T>[], "versionchange">,
) => Promise<void>;

async function createBotsStore(
    db: IDBPDatabase<ChatSchema>,
    _principal: Principal,
    _tx: IDBPTransaction<ChatSchema, StoreNames<ChatSchema>[], "versionchange">,
) {
    if (db.objectStoreNames.contains("bots")) {
        db.deleteObjectStore("bots");
    }
    db.createObjectStore("bots");
}

async function createActivityFeed(
    db: IDBPDatabase<ChatSchema>,
    _principal: Principal,
    _tx: IDBPTransaction<ChatSchema, StoreNames<ChatSchema>[], "versionchange">,
) {
    if (db.objectStoreNames.contains("activityFeed")) {
        db.deleteObjectStore("activityFeed");
    }
    db.createObjectStore("activityFeed");
}

async function clearChatsStore(
    _db: IDBPDatabase<ChatSchema>,
    _principal: Principal,
    tx: IDBPTransaction<ChatSchema, StoreNames<ChatSchema>[], "versionchange">,
) {
    await tx.objectStore("chats").clear();
}

async function clearGroupDetailsStore(
    _db: IDBPDatabase<ChatSchema>,
    _principal: Principal,
    tx: IDBPTransaction<ChatSchema, StoreNames<ChatSchema>[], "versionchange">,
) {
    await tx.objectStore("group_details").clear();
}

async function clearCommunityDetailsStore(
    _db: IDBPDatabase<ChatSchema>,
    _principal: Principal,
    tx: IDBPTransaction<ChatSchema, StoreNames<ChatSchema>[], "versionchange">,
) {
    await tx.objectStore("community_details").clear();
}

async function clearEverything(
    db: IDBPDatabase<ChatSchema>,
    _principal: Principal,
    _tx: IDBPTransaction<ChatSchema, StoreNames<ChatSchema>[], "versionchange">,
) {
    nuke(db);
}

async function clearEvents(
    _db: IDBPDatabase<ChatSchema>,
    _principal: Principal,
    tx: IDBPTransaction<ChatSchema, StoreNames<ChatSchema>[], "versionchange">,
) {
    await tx.objectStore("chat_events").clear();
}

async function clearChatAndGroups(
    _db: IDBPDatabase<ChatSchema>,
    _principal: Principal,
    tx: IDBPTransaction<ChatSchema, StoreNames<ChatSchema>[], "versionchange">,
) {
    await clearChatsStore(_db, _principal, tx);
    await clearGroupDetailsStore(_db, _principal, tx);
}

async function clearExternalAchievements(
    _db: IDBPDatabase<ChatSchema>,
    _principal: Principal,
    tx: IDBPTransaction<ChatSchema, StoreNames<ChatSchema>[], "versionchange">,
) {
    await tx.objectStore("externalAchievements").clear();
}

const migrations: Record<number, MigrationFunction<ChatSchema>> = {
    115: clearEverything,
    116: async (db, principal, transaction) => {
        await Promise.all([
            clearGroupDetailsStore(db, principal, transaction),
            clearCommunityDetailsStore(db, principal, transaction),
        ]);
    },
    117: clearChatAndGroups,
    118: async (db, principal, tx) => {
        await Promise.all([
            clearChatsStore(db, principal, tx),
            createActivityFeed(db, principal, tx),
        ]);
    },
    119: clearExternalAchievements,
    120: async (db, principal, tx) => {
        await Promise.all([
            clearCommunityDetailsStore(db, principal, tx),
            createBotsStore(db, principal, tx),
        ]);
    },
    121: async (db, principal, tx) => {
        await Promise.all([
            clearEvents(db, principal, tx),
            clearGroupDetailsStore(db, principal, tx),
        ]);
    },
    122: clearGroupDetailsStore,
};

async function migrate(
    db: IDBPDatabase<ChatSchema>,
    principal: Principal,
    from: number,
    to: number,
    transaction: IDBPTransaction<ChatSchema, StoreNames<ChatSchema>[], "versionchange">,
) {
    for (let version = from + 1; version <= to; version++) {
        if (migrations[version]) {
            console.debug(`DB: applying migration for version ${version}`);
            await migrations[version](db, principal, transaction);
        }
    }
}

function nuke(db: IDBPDatabase<ChatSchema>) {
    if (db.objectStoreNames.contains("chat_events")) {
        db.deleteObjectStore("chat_events");
    }
    if (db.objectStoreNames.contains("thread_events")) {
        db.deleteObjectStore("thread_events");
    }
    if (db.objectStoreNames.contains("expiredMessageRanges")) {
        db.deleteObjectStore("expiredMessageRanges");
    }
    if (db.objectStoreNames.contains("chats")) {
        db.deleteObjectStore("chats");
    }
    if (db.objectStoreNames.contains("bots")) {
        db.deleteObjectStore("bots");
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
    if (db.objectStoreNames.contains("currentUser")) {
        db.deleteObjectStore("currentUser");
    }
    if (db.objectStoreNames.contains("localUserIndex")) {
        db.deleteObjectStore("localUserIndex");
    }
    if (db.objectStoreNames.contains("externalAchievements")) {
        db.deleteObjectStore("externalAchievements");
    }
    if (db.objectStoreNames.contains("activityFeed")) {
        db.deleteObjectStore("activityFeed");
    }
    const chatEvents = db.createObjectStore("chat_events");
    chatEvents.createIndex("messageIdx", "messageKey");
    chatEvents.createIndex("expiresAt", "expiresAt");
    const threadEvents = db.createObjectStore("thread_events");
    threadEvents.createIndex("messageIdx", "messageKey");
    db.createObjectStore("chats");
    db.createObjectStore("group_details");
    db.createObjectStore("community_details");
    db.createObjectStore("failed_chat_messages");
    db.createObjectStore("failed_thread_messages");
    db.createObjectStore("cachePrimer");
    db.createObjectStore("currentUser");
    db.createObjectStore("localUserIndex");
    db.createObjectStore("externalAchievements");
    db.createObjectStore("activityFeed");
    db.createObjectStore("bots");
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
        upgrade(db, previousVersion, newVersion, transaction) {
            if (
                previousVersion == null ||
                previousVersion < EARLIEST_SUPPORTED_MIGRATION ||
                newVersion == null
            ) {
                nuke(db);
            } else {
                console.debug(`DB: migrating database from ${previousVersion} to ${newVersion}`);
                migrate(db, principal, previousVersion, newVersion, transaction).then(() => {
                    console.debug(
                        `DB: migration from ${previousVersion} to ${newVersion} complete`,
                    );
                });
            }
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

export async function getCachedBots(
    db: Database,
    principal: Principal,
): Promise<BotsResponse | undefined> {
    return (await db).get("bots", principal.toString());
}

export async function setCachedBots(db: Database, principal: Principal, bots: BotsResponse) {
    (await db).put("bots", bots, principal.toString());
}

export async function getCachedChats(
    db: Database,
    principal: Principal,
): Promise<ChatStateFull | undefined> {
    const resolvedDb = await db;
    const chats = await resolvedDb.get("chats", principal.toString());

    if (
        chats !== undefined &&
        chats.latestUserCanisterUpdates < BigInt(Date.now() - 30 * ONE_DAY)
    ) {
        // If the cache was last updated more than 30 days ago, clear the cache and return undefined
        const storeNames = resolvedDb.objectStoreNames;
        for (let i = 0; i < storeNames.length; i++) {
            await resolvedDb.clear(storeNames[i]);
        }
        return undefined;
    }
    return chats;
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

export async function getCachedEvents(
    db: Database,
    eventIndexRange: IndexRange,
    context: MessageContext,
    startIndex: number,
    ascending: boolean,
    maxEvents = MAX_EVENTS,
    maxMessages = MAX_MESSAGES,
    maxMissing = 50,
): Promise<[EventsSuccessResult<ChatEvent>, Set<number>]> {
    console.debug("CACHE: ", context, eventIndexRange, startIndex, ascending);
    const start = Date.now();

    const [events, expiredEventRanges, missing] = await iterateCachedEvents(
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

    return [
        {
            events: events as EventWrapper<ChatEvent>[],
            expiredEventRanges,
            expiredMessageRanges: [],
            latestEventIndex: undefined,
        },
        missing,
    ];
}

export async function getCachedEventsWindowByMessageIndex(
    db: Database,
    eventIndexRange: IndexRange,
    context: MessageContext,
    messageIndex: number,
    maxEvents = MAX_EVENTS,
    maxMessages = MAX_MESSAGES,
    maxMissing = 50,
): Promise<[EventsSuccessResult<ChatEvent>, Set<number>, boolean]> {
    const eventIndex = await getNearestCachedEventIndexForMessageIndex(db, context, messageIndex);

    if (eventIndex === undefined) {
        return [
            {
                events: [],
                expiredEventRanges: [],
                expiredMessageRanges: [],
                latestEventIndex: undefined,
            },
            new Set(),
            true,
        ];
    }

    const [events, missing] = await getCachedEventsWindow(
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

export async function getCachedEventsWindow(
    db: Database,
    eventIndexRange: IndexRange,
    context: MessageContext,
    startIndex: number,
    maxEvents = MAX_EVENTS,
    maxMessages = MAX_MESSAGES,
    maxMissing = 50,
): Promise<[EventsSuccessResult<ChatEvent>, Set<number>]> {
    console.debug("CACHE: window: ", eventIndexRange, startIndex);
    const start = Date.now();
    const resolvedDb = await db;

    const promises = [] as Promise<
        [EnhancedWrapper<ChatEvent>[], ExpiredEventsRange[], Set<number>]
    >[];
    if (eventIndexRange[0] <= startIndex - 1) {
        promises.push(
            iterateCachedEvents(
                resolvedDb,
                eventIndexRange,
                context,
                startIndex - 1,
                false,
                maxEvents / 2,
                maxMessages / 2,
                maxMissing / 2,
            ),
        );
    }
    if (eventIndexRange[1] >= startIndex) {
        promises.push(
            iterateCachedEvents(
                resolvedDb,
                eventIndexRange,
                context,
                startIndex,
                true,
                maxEvents / 2,
                maxMessages / 2,
                maxMissing / 2,
            ),
        );
    }

    const results: EventsSuccessResult<ChatEvent> = {
        events: [],
        expiredEventRanges: [],
        expiredMessageRanges: [],
        latestEventIndex: undefined,
    };
    const combinedMissing = new Set<number>();
    for (const [events, expiredEventRanges, missing] of await Promise.all(promises)) {
        events.forEach((e) => results.events.push(e));
        expiredEventRanges.forEach((r) => results.expiredEventRanges.push(r));
        missing.forEach((m) => combinedMissing.add(m));
    }

    if (combinedMissing.size === 0) {
        console.debug("CACHE: hit: ", results.events.length, Date.now() - start);
    }

    return [results, combinedMissing];
}

export async function getCachedEventByIndex(
    db: IDBPDatabase<ChatSchema>,
    eventIndex: number,
    context: MessageContext,
    now: number = Date.now(),
): Promise<EnhancedWrapper<ChatEvent> | ExpiredEventsRange | undefined> {
    const storeName =
        context.threadRootMessageIndex === undefined ? "chat_events" : "thread_events";
    const key = createCacheKey(context, eventIndex);
    const upperBound = createCacheKey(context, MAX_INDEX);

    const event = processEventExpiry(
        await db.get(storeName, IDBKeyRange.bound(key, upperBound)),
        now,
    );

    if (
        (event?.kind === "event" && event.index === eventIndex) ||
        (event?.kind === "expired_events_range" && event.start <= eventIndex)
    ) {
        return event as EnhancedWrapper<ChatEvent> | ExpiredEventsRange;
    }
    return undefined;
}

export async function getCachedEventsByIndex(
    db: Database,
    eventIndexes: number[],
    context: MessageContext,
): Promise<[EventsSuccessResult<ChatEvent>, Set<number>]> {
    const events: EnhancedWrapper<ChatEvent>[] = [];
    const expiredEventRanges: ExpiredEventsRange[] = [];
    const missing = new Set<number>();
    const resolvedDb = await db;
    const now = Date.now();
    await Promise.all(
        eventIndexes.map(async (idx) => {
            const evt = await getCachedEventByIndex(resolvedDb, idx, context, now);
            if (evt === undefined) {
                missing.add(idx);
            } else if (evt.kind === "event") {
                events.push(evt);
            } else {
                expiredEventRanges.push(evt);
            }
        }),
    );
    return [
        {
            events: events as EventWrapper<ChatEvent>[],
            expiredEventRanges,
            expiredMessageRanges: [],
            latestEventIndex: undefined,
        },
        missing,
    ];
}

// If we don't find the precise index we are looking for, look for the previous index
// This optimises the case where we looking for the next unread message. We won't have that
// but we probably *will* have the message before.
export async function getNearestCachedEventIndexForMessageIndex(
    db: Database,
    context: MessageContext,
    messageIndex: number,
    iterations = 0,
): Promise<number | undefined> {
    const eventIndex = await getCachedEventIndexByMessageIndex(db, context, messageIndex);
    if (eventIndex === undefined && iterations === 0 && messageIndex > 0) {
        console.debug(
            "EV: we didn't find the event index for ",
            messageIndex,
            " recursing to look for event index for ",
            messageIndex - 1,
        );
        return getNearestCachedEventIndexForMessageIndex(
            db,
            context,
            messageIndex - 1,
            iterations + 1,
        );
    }
    return eventIndex;
}

async function getCachedEventIndexByMessageIndex(
    db: Database,
    context: MessageContext,
    messageIndex: number,
): Promise<number | undefined> {
    const store = context.threadRootMessageIndex !== undefined ? "thread_events" : "chat_events";
    const cacheKey = createCacheKey(context, messageIndex);
    const cacheKeyUpperBound = createCacheKey(context, MAX_INDEX);
    const resolvedDb = await db;

    const value = await resolvedDb.getFromIndex(
        store,
        "messageIdx",
        IDBKeyRange.bound(cacheKey, cacheKeyUpperBound),
    );

    if (
        value !== undefined &&
        value.kind === "event" &&
        value.event.kind === "message" &&
        value.event.messageIndex === messageIndex
    ) {
        return value.index;
    }
    return undefined;
}

export function mergeSuccessResponses(
    a: EventsSuccessResult<ChatEvent>,
    b: EventsSuccessResult<ChatEvent>,
): EventsSuccessResult<ChatEvent> {
    return {
        events: [...a.events, ...b.events].sort((a, b) => getIndex(a) - getIndex(b)),
        expiredEventRanges: [...a.expiredEventRanges, ...b.expiredEventRanges],
        expiredMessageRanges: [...a.expiredMessageRanges, ...b.expiredMessageRanges],
        latestEventIndex:
            a.latestEventIndex === undefined && b.latestEventIndex === undefined
                ? undefined
                : Math.max(a.latestEventIndex ?? -1, b.latestEventIndex ?? -1),
    };
}

function getIndex(event: EventWrapper<ChatEvent> | ExpiredEventsRange): number {
    if ("index" in event) return event.index;
    return event.start;
}

// we need to strip out the blobData promise from any media content because that cannot be serialised
function makeSerialisable<T extends ChatEvent>(
    ev: EventWrapper<T>,
    chatId: ChatIdentifier,
    removeBlobs: boolean,
    threadRootMessageIndex?: number,
): EnhancedWrapper<T> {
    if (ev.event.kind !== "message")
        return { ...ev, kind: "event", chatId: { ...chatId }, messageKey: undefined };

    return {
        ...ev,
        kind: "event",
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
    if (!canRetryMessage(event.event.content)) {
        return;
    }

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
): Promise<MessageContextMap<Record<string, EventWrapper<Message>>>> {
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
        val[ev.event.messageId.toString()] = ev;
        res.set(context, val);
        return res;
    }, new MessageContextMap<Record<string, EventWrapper<Message>>>());
}

export async function setCachedEvents(
    db: Database,
    chatId: ChatIdentifier,
    resp: EventsResponse<ChatEvent>,
    threadRootMessageIndex: number | undefined,
): Promise<void> {
    if (resp === "events_failed") return;
    const store = threadRootMessageIndex !== undefined ? "thread_events" : "chat_events";

    const tx = (await db).transaction([store], "readwrite", {
        durability: "relaxed",
    });
    const eventStore = tx.objectStore(store);
    const promises: Promise<void>[] = resp.events.map((event) =>
        eventStore
            .put(
                makeSerialisable<ChatEvent>(event, chatId, true, threadRootMessageIndex),
                createCacheKey({ chatId, threadRootMessageIndex }, event.index),
            )
            .then((_) => {}),
    );

    // If there are any expired event ranges, insert the range details at either end of the range and delete all
    // cache entries within the range
    if (resp.expiredEventRanges.length > 0) {
        for (const range of resp.expiredEventRanges) {
            const boundaryKeys = [createCacheKey({ chatId, threadRootMessageIndex }, range.start)];
            if (range.start !== range.end) {
                boundaryKeys.push(createCacheKey({ chatId, threadRootMessageIndex }, range.end));
            }

            promises.push(...boundaryKeys.map((k) => eventStore.put(range, k).then((_) => {})));

            if (range.start < range.end - 1) {
                // Delete all cache entries within the range
                promises.push(
                    eventStore.delete(
                        IDBKeyRange.bound(
                            createCacheKey({ chatId, threadRootMessageIndex }, range.start + 1),
                            createCacheKey({ chatId, threadRootMessageIndex }, range.end - 1),
                        ),
                    ),
                );
            }
        }
    }
    await Promise.all(promises);
    await tx.done;
}

export function setCachedMessageFromSendResponse(
    db: Database,
    chatId: ChatIdentifier,
    sentEvent: EventWrapper<Message>,
    threadRootMessageIndex?: number,
): ([resp, message]: [SendMessageResponse, Message]) => [SendMessageResponse, Message] {
    return ([resp, message]: [SendMessageResponse, Message]) => {
        if (resp.kind !== "success" && resp.kind !== "transfer_success") {
            recordFailedMessage(db, chatId, sentEvent, threadRootMessageIndex);
            return [resp, message];
        }

        const event = messageToEvent(message, resp);

        setCachedMessageIfNotExists(db, chatId, event, threadRootMessageIndex);

        return [resp, event.event];
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
            makeSerialisable<Message>(messageEvent, chatId, true, threadRootMessageIndex),
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
    chatId: ChatIdentifier,
    timestamp: bigint,
): Promise<void> {
    await (await db).put("cachePrimer", timestamp, chatIdentifierToString(chatId));
}

function messageToEvent(
    message: Message,
    resp: SendMessageSuccess | TransferSuccess,
): EventWrapper<Message> {
    let content = message.content;

    if (resp.kind === "transfer_success") {
        switch (message.content.kind) {
            case "crypto_content":
                content = { ...message.content, transfer: resp.transfer } as CryptocurrencyContent;
                break;
            case "prize_content_initial":
                content = {
                    kind: "prize_content",
                    prizesRemaining: message.content.prizes.length,
                    prizesPending: 0,
                    winners: [],
                    token: message.content.transfer.token,
                    endDate: message.content.endDate,
                    caption: message.content.caption,
                    diamondOnly: message.content.diamondOnly,
                    lifetimeDiamondOnly: message.content.lifetimeDiamondOnly,
                    uniquePersonOnly: message.content.uniquePersonOnly,
                    streakOnly: message.content.streakOnly,
                } as PrizeContent;
                break;
            case "p2p_swap_content_initial":
                content = {
                    kind: "p2p_swap_content",
                    token0: message.content.token0,
                    token0Amount: message.content.token0Amount,
                    token1: message.content.token1,
                    token1Amount: message.content.token1Amount,
                    caption: message.content.caption,
                    expiresAt: BigInt(Date.now()) + message.content.expiresIn,
                    status: { kind: "p2p_swap_open" },
                    token0TxnIn: resp.transfer.blockIndex,
                    // Note: we don't have this in the response but actually we don't use it on the FE
                    swapId: 0,
                } as P2PSwapContent;
                break;
        }
    }

    return {
        event: {
            ...message,
            messageIndex: resp.messageIndex,
            content,
        },
        index: resp.eventIndex,
        timestamp: resp.timestamp,
        expiresAt: resp.expiresAt,
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
            if (evt?.kind === "event" && evt.event.kind === "message") {
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
        latestMessage: makeSerialisable<Message>(chat.latestMessage, chat.id, true),
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

async function iterateCachedEvents(
    db: IDBPDatabase<ChatSchema>,
    eventIndexRange: IndexRange,
    context: MessageContext,
    startIndex: number,
    ascending: boolean,
    maxEvents: number,
    maxMessages: number,
    maxMissing: number,
): Promise<[EnhancedWrapper<ChatEvent>[], ExpiredEventsRange[], Set<number>]> {
    const bound = ascending ? eventIndexRange[1] : eventIndexRange[0];
    const iterator = await EventsIterator.create(db, context, startIndex, ascending, bound);

    const events: EnhancedWrapper<ChatEvent>[] = [];
    const expiredEventRanges: ExpiredEventsRange[] = [];
    const missing = new Set<number>();
    let messageCount = 0;
    let expectedNextIndex: number = startIndex;

    while (events.length < maxEvents) {
        const next = await iterator.getNext();
        if (next === undefined) {
            let remainingMissingCount = Math.min(
                maxMessages - messageCount,
                maxEvents - events.length,
            );
            if (ascending) {
                for (let i = expectedNextIndex; i <= bound; i++) {
                    missing.add(i);
                    if (--remainingMissingCount === 0) break;
                }
            } else {
                for (let i = expectedNextIndex; i >= bound; i--) {
                    missing.add(i);
                    if (--remainingMissingCount === 0) break;
                }
            }
            break;
        }

        if (ascending) {
            const [startIndex, endIndex] =
                next.kind === "event" ? [next.index, next.index] : [next.start, next.end];

            for (let i = expectedNextIndex; i < startIndex; i++) {
                missing.add(i);
                if (missing.size > maxMissing) {
                    break;
                }
            }

            expectedNextIndex = endIndex + 1;
        } else {
            const [startIndex, endIndex] =
                next.kind === "event" ? [next.index, next.index] : [next.end, next.start];

            for (let i = expectedNextIndex; i > startIndex; i--) {
                missing.add(i);
                if (missing.size > maxMissing) {
                    break;
                }
            }

            expectedNextIndex = endIndex - 1;
        }

        if (next.kind === "event") {
            events.push(next);

            if (next.event.kind === "message") {
                if (++messageCount == maxMessages) {
                    break;
                }
            }
        } else {
            expiredEventRanges.push(next);
        }
    }

    return [events, expiredEventRanges, missing];
}

function mergeRanges(left: ExpiredEventsRange, right: ExpiredEventsRange): ExpiredEventsRange {
    return {
        kind: "expired_events_range",
        start: Math.min(left.start, right.start),
        end: Math.max(left.end, right.end),
    };
}

function isContiguous(left: ExpiredEventsRange, right: ExpiredEventsRange): boolean {
    if (left.start <= right.start) {
        return right.start >= left.end + 1;
    } else {
        return left.start <= right.end + 1;
    }
}

class EventsIterator {
    private readonly now: number;
    private current: EnhancedWrapper<ChatEvent> | ExpiredEventsRange | undefined;

    private constructor(
        private cursor?: IDBPCursorWithValue<
            ChatSchema,
            ("chat_events" | "thread_events")[],
            "chat_events" | "thread_events"
        > | null,
        private onComplete?: () => Promise<void>,
    ) {
        this.now = Date.now();
        this.current = processEventExpiry(cursor?.value, this.now);
    }

    static async create(
        db: IDBPDatabase<ChatSchema>,
        messageContext: MessageContext,
        startIndex: number,
        ascending: boolean,
        bound: number,
    ): Promise<EventsIterator> {
        if ((ascending && startIndex > bound) || (!ascending && startIndex < bound)) {
            throw new Error(
                `Start index exceeds bound. ${JSON.stringify({
                    messageContext,
                    startIndex,
                    ascending,
                    bound,
                })}`,
            );
        }

        const storeName =
            messageContext.threadRootMessageIndex === undefined ? "chat_events" : "thread_events";
        const transaction = db.transaction([storeName]);
        const store = transaction.objectStore(storeName);
        const startKey = createCacheKey(messageContext, startIndex);
        const [lower, upper] = ascending
            ? [startKey, createCacheKey(messageContext, bound)]
            : [createCacheKey(messageContext, bound), startKey];

        const cursor = await store.openCursor(
            IDBKeyRange.bound(lower, upper),
            ascending ? "next" : "prev",
        );

        return new EventsIterator(cursor, () => transaction.done);
    }

    async getNext(): Promise<EnhancedWrapper<ChatEvent> | ExpiredEventsRange | undefined> {
        const current = this.current;
        if (current === undefined) {
            return undefined;
        }

        await this.advance();

        const next = processEventExpiry(this.cursor?.value, this.now);

        // If this value matches the previous value, skip it, and yield the next value instead
        if (
            next?.kind === "expired_events_range" &&
            current?.kind === "expired_events_range" &&
            isContiguous(current, next)
        ) {
            this.current = mergeRanges(current, next);
            return await this.getNext();
        }

        this.current = next;
        return current;
    }

    private async advance(): Promise<boolean> {
        try {
            await this.cursor?.advance(1);
            return true;
        } catch {
            this.cursor = undefined;
            if (this.onComplete !== undefined) {
                await this.onComplete();
            }
            return false;
        }
    }
}

function processEventExpiry(
    event: EnhancedWrapper<ChatEvent> | ExpiredEventsRange | undefined,
    now: number,
): EnhancedWrapper<ChatEvent> | ExpiredEventsRange | undefined {
    if (
        event === undefined ||
        event.kind === "expired_events_range" ||
        event.expiresAt === undefined ||
        event.expiresAt > now
    ) {
        return event;
    }

    tryStartExpiredEventSweeper();

    return {
        kind: "expired_events_range",
        start: event.index,
        end: event.index,
    };
}

let expiredEventSweeperJob: NodeJS.Timeout | undefined;

function tryStartExpiredEventSweeper() {
    if (expiredEventSweeperJob !== undefined) return;

    expiredEventSweeperJob = setTimeout(runExpiredEventSweeper, 5000);
}

// TODO we can improve this by replacing these events with expired event ranges
async function runExpiredEventSweeper() {
    if (db === undefined) return;
    const transaction = (await db).transaction(["chat_events", "thread_events"], "readwrite");
    const eventsStore = transaction.objectStore("chat_events");
    const threadEventsStore = transaction.objectStore("thread_events");
    const index = eventsStore.index("expiresAt");
    const batchSize = 100;
    const expiredKeys = await index.getAllKeys(IDBKeyRange.upperBound(Date.now()), batchSize);

    async function deleteKey(key: string): Promise<void> {
        const value = await eventsStore.get(key);
        if (value?.kind !== "event") {
            return;
        }

        const promises: Promise<void>[] = [eventsStore.delete(key)];

        if (
            value.event.kind === "message" &&
            value.event.thread !== undefined &&
            value.messageKey !== undefined
        ) {
            const threadKey = value.messageKey.replace(/_0+/, "_"); // Remove the 0's which pad the message index
            promises.push(
                threadEventsStore.delete(IDBKeyRange.bound(threadKey + "_", threadKey + "_Z")),
            );
        }

        await Promise.all(promises);
    }

    await Promise.all(expiredKeys.map(deleteKey));

    expiredEventSweeperJob = undefined;

    // If the batch was full, run the job again
    if (expiredKeys.length === batchSize) {
        tryStartExpiredEventSweeper();
    }
}

export async function getCachedCurrentUser(principal: string): Promise<CreatedUser | undefined> {
    if (db === undefined) return;
    return (await db).get("currentUser", principal);
}

export async function mergeCachedCurrentUser(
    principal: string,
    updated: CurrentUserSummary,
): Promise<void> {
    if (db === undefined) return;
    const current = await getCachedCurrentUser(principal);
    if (current) {
        const merged = updateCreatedUser(current, updated);
        (await db).put("currentUser", merged, principal);
    }
}

export async function setCachedCurrentUser(principal: string, user: CreatedUser): Promise<void> {
    if (db === undefined) return;
    (await db).put("currentUser", user, principal);
}

export async function setCurrentUserDiamondStatusInCache(
    principal: string,
    diamondStatus: DiamondMembershipStatus,
): Promise<void> {
    const user = await getCachedCurrentUser(principal);
    if (user === undefined || db === undefined) return;
    (await db).put(
        "currentUser",
        {
            ...user,
            diamondStatus,
        },
        principal,
    );
}

export async function getLocalUserIndexForUser(userId: string): Promise<string | undefined> {
    if (db === undefined) return;
    return (await db).get("localUserIndex", userId);
}

export async function cacheLocalUserIndexForUser(
    userId: string,
    localUserIndex: string,
): Promise<string> {
    if (db === undefined) return localUserIndex;
    (await db).put("localUserIndex", localUserIndex, userId);
    return localUserIndex;
}

export async function clearCache(principal: string): Promise<void> {
    const name = `openchat_db_${principal}`;
    try {
        if (db !== undefined) {
            (await db).close();
        }
        await deleteDB(name);
        console.error("deleted db: ", name);
    } catch (err) {
        console.error("Unable to delete db: ", name, err);
    }
}

export async function getCachedExternalAchievements(): Promise<
    { lastUpdated: bigint; achievements: ExternalAchievement[] } | undefined
> {
    if (db === undefined) return undefined;
    return (await db).get("externalAchievements", "value");
}

export async function setCachedExternalAchievements(
    lastUpdated: bigint,
    achievements: ExternalAchievement[],
): Promise<void> {
    if (db === undefined) return;
    (await db).put("externalAchievements", { lastUpdated, achievements }, "value");
}

export async function getActivityFeedEvents(): Promise<MessageActivityEvent[]> {
    if (db === undefined) return [];
    const result = await (await db).get("activityFeed", "value");
    return result ?? [];
}

export async function setActivityFeedEvents(activity: MessageActivityEvent[]): Promise<void> {
    if (db === undefined) return;
    (await db).put("activityFeed", activity, "value");
}
