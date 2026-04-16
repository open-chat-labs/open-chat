import type { Principal } from "@icp-sdk/core/principal";
import {
    deleteDB,
    type DBSchema,
    type IDBPCursorWithValue,
    type IDBPDatabase,
    type IDBPTransaction,
    type StoreNames,
    type StoreValue,
} from "idb";
import type {
    BotsResponse,
    ChatEvent,
    ChatIdentifier,
    ChatStateFull,
    ChatSummary,
    CommunityDetails,
    CommunitySummary,
    CreatedUser,
    CryptocurrencyContent,
    CurrentUserSummary,
    DataContent,
    DiamondMembershipStatus,
    EventWrapper,
    EventsResponse,
    EventsSuccessResult,
    ExpiredEventsRange,
    ExternalAchievement,
    GroupChatDetails,
    IndexRange,
    Message,
    MessageActivityEvent,
    MessageContent,
    MessageContext,
    P2PSwapContent,
    PrizeContent,
    PublicProfile,
    ReplyContext,
    SendMessageResponse,
    SendMessageSuccess,
    Tally,
    TransferSuccess,
    UpdatedEvent,
} from "openchat-shared";
import {
    ChatMap,
    MAX_EVENTS,
    MAX_MESSAGES,
    MessageContextMap,
    ONE_DAY,
    canRetryMessage,
    chatIdentifierToString,
    chatIdentifiersEqual,
    emptyEventsResponse,
    isSuccessfulEventsResponse,
    updateCreatedUser,
} from "openchat-shared";
import { IndexedDbConnectionManager } from "./indexedDb";

const CACHE_VERSION = 148;
const MAX_INDEX = 9999999999;

export type Database = Promise<IDBPDatabase<ChatSchema>>;

type EnhancedWrapper<T extends ChatEvent> = EventWrapper<T> & {
    kind: "event";
    chatId: ChatIdentifier;
    messageKey: string | undefined;
    dirty?: boolean;
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
        value: number;
    };

    currentUser: {
        key: string;
        value: CreatedUser;
    };

    publicProfile: {
        key: string;
        value: PublicProfile;
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

// async function createBotsStore(
//     db: IDBPDatabase<ChatSchema>,
//     _principal: Principal,
//     _tx: IDBPTransaction<ChatSchema, StoreNames<ChatSchema>[], "versionchange">,
// ) {
//     if (db.objectStoreNames.contains("bots")) {
//         db.deleteObjectStore("bots");
//     }
//     db.createObjectStore("bots");
// }
//
// async function createActivityFeed(
//     db: IDBPDatabase<ChatSchema>,
//     _principal: Principal,
//     _tx: IDBPTransaction<ChatSchema, StoreNames<ChatSchema>[], "versionchange">,
// ) {
//     if (db.objectStoreNames.contains("activityFeed")) {
//         db.deleteObjectStore("activityFeed");
//     }
//     db.createObjectStore("activityFeed");
// }
//
async function clearChatsStore(
    _db: IDBPDatabase<ChatSchema>,
    tx: IDBPTransaction<ChatSchema, StoreNames<ChatSchema>[], "versionchange">,
) {
    await tx.objectStore("chats").clear();
}
//
// async function clearGroupDetailsStore(
//     _db: IDBPDatabase<ChatSchema>,
//     _principal: Principal,
//     tx: IDBPTransaction<ChatSchema, StoreNames<ChatSchema>[], "versionchange">,
// ) {
//     await tx.objectStore("group_details").clear();
// }
async function clearCachePrimerStore(
    _db: IDBPDatabase<ChatSchema>,
    tx: IDBPTransaction<ChatSchema, StoreNames<ChatSchema>[], "versionchange">,
) {
    await tx.objectStore("cachePrimer").clear();
}

async function clearCommunityDetailsStore(
    _db: IDBPDatabase<ChatSchema>,
    tx: IDBPTransaction<ChatSchema, StoreNames<ChatSchema>[], "versionchange">,
) {
    await tx.objectStore("community_details").clear();
}
//
// async function clearEverything(
//     db: IDBPDatabase<ChatSchema>,
//     _principal: Principal,
//     _tx: IDBPTransaction<ChatSchema, StoreNames<ChatSchema>[], "versionchange">,
// ) {
//     nuke(db);
// }
//
async function clearEvents(
    _db: IDBPDatabase<ChatSchema>,
    tx: IDBPTransaction<ChatSchema, StoreNames<ChatSchema>[], "versionchange">,
) {
    await tx.objectStore("chat_events").clear();
}

// async function clearChatAndGroups(
//     _db: IDBPDatabase<ChatSchema>,
//     _principal: Principal,
//     tx: IDBPTransaction<ChatSchema, StoreNames<ChatSchema>[], "versionchange">,
// ) {
//     await clearChatsStore(_db, _principal, tx);
//     await clearGroupDetailsStore(_db, _principal, tx);
// }
//
// async function clearExternalAchievements(
//     _db: IDBPDatabase<ChatSchema>,
//     _principal: Principal,
//     tx: IDBPTransaction<ChatSchema, StoreNames<ChatSchema>[], "versionchange">,
// ) {
//     await tx.objectStore("externalAchievements").clear();
// }

async function clearChatsAndCurrentUser(
    _db: IDBPDatabase<ChatSchema>,
    tx: IDBPTransaction<ChatSchema, StoreNames<ChatSchema>[], "versionchange">,
) {
    await clearChatsStore(_db, tx);
    await tx.objectStore("currentUser").clear();
}

async function createPublicProfileStore(
    db: IDBPDatabase<ChatSchema>,
    _tx: IDBPTransaction<ChatSchema, StoreNames<ChatSchema>[], "versionchange">,
) {
    if (db.objectStoreNames.contains("publicProfile")) {
        db.deleteObjectStore("publicProfile");
    }
    db.createObjectStore("publicProfile");
}

export class ChatsDb {
    private readonly idbConnectionManager: IndexedDbConnectionManager<ChatSchema>;
    private readonly principalString: string;
    private expiredEventSweeperJob: NodeJS.Timeout | undefined;

    constructor(principal: Principal) {
        this.principalString = principal.toString();
        this.idbConnectionManager = IndexedDbConnectionManager.create<ChatSchema>(
            `openchat_db_${this.principalString}`,
            [
                { name: "chats" },
                { name: "bots" },
                {
                    name: "chat_events",
                    indexes: {
                        messageIdx: "messageKey",
                        expiresAt: "expiresAt",
                    },
                },
                {
                    name: "thread_events",
                    indexes: {
                        messageIdx: "messageKey",
                    },
                },
                { name: "group_details" },
                { name: "community_details" },
                { name: "failed_chat_messages" },
                { name: "failed_thread_messages" },
                { name: "cachePrimer" },
                { name: "currentUser" },
                { name: "publicProfile" },
                { name: "localUserIndex" },
                { name: "externalAchievements" },
                { name: "activityFeed" },
            ],
            CACHE_VERSION,
        )
            .withMigration(138, clearCommunityDetailsStore)
            .withMigration(139, clearEvents)
            .withMigration(140, clearChatsAndCurrentUser)
            .withMigration(141, createPublicProfileStore)
            .withMigration(142, clearCommunityDetailsStore)
            .withMigration(143, clearChatsStore)
            .withMigration(144, clearChatsStore)
            .withMigration(145, clearCachePrimerStore)
            .withMigration(146, clearEvents)
            .withMigration(147, clearCachePrimerStore);
    }

    getDb(): Database {
        return this.idbConnectionManager.getDb();
    }

    async getCachedBots(): Promise<BotsResponse | undefined> {
        return (await this.getDb()).get("bots", this.principalString);
    }

    setCachedBots(bots: BotsResponse) {
        this.getDb().then((db) => db.put("bots", bots, this.principalString));
    }

    async getCachedChats(): Promise<ChatStateFull | undefined> {
        const resolvedDb = await this.getDb();
        const chats = await resolvedDb.get("chats", this.principalString);

        if (chats && chats.latestUserCanisterUpdates < BigInt(Date.now() - 30 * ONE_DAY)) {
            const storeNames = resolvedDb.objectStoreNames;
            for (let i = 0; i < storeNames.length; i++) {
                await resolvedDb.clear(storeNames[i]);
            }
            return undefined;
        }
        return chats;
    }

    async setCachedChats(
        chatState: ChatStateFull,
        updatedEvents: ChatMap<UpdatedEvent[]>,
    ): Promise<void> {
        const db = this.getDb();
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

        const markDirtyRequests = [...updatedEvents.entries()].flatMap(([chatId, indexes]) => {
            return indexes.map(async (i) => {
                const key = createCacheKey(
                    { chatId, threadRootMessageIndex: i.threadRootMessageIndex },
                    i.eventIndex,
                );
                const store = i.threadRootMessageIndex === undefined ? eventsStore : threadsStore;

                const event = await store.get(key);
                if (event?.kind === "event" && !event.dirty) {
                    await store.put({ ...event, dirty: true }, key);
                }
            });
        });

        const promises = [chatsStore.put(stateToCache, this.principalString), ...markDirtyRequests];

        await Promise.all(promises);
        await tx.done;
    }

    async deleteEventsForChatOrCommunity(chatOrCommunityId: string) {
        try {
            const tx = (await this.getDb()).transaction("chat_events", "readwrite", {
                durability: "relaxed",
            });
            const store = tx.objectStore("chat_events");
            const cursor = await store.openCursor(IDBKeyRange.lowerBound(chatOrCommunityId));
            while (cursor?.key !== undefined && cursor.key.startsWith(chatOrCommunityId)) {
                await store.delete(cursor.key);
                await cursor.continue();
            }
            await tx.done;
        } catch (err) {
            console.warn("Error deleting events for chat: ", err);
        }
    }

    async getCachedEvents(
        eventIndexRange: IndexRange,
        context: MessageContext,
        startIndex: number,
        ascending: boolean,
        maxEvents = MAX_EVENTS,
        maxMessages = MAX_MESSAGES,
        maxMissing = 50,
        allowDirty = true,
    ): Promise<[EventsSuccessResult<ChatEvent>, Set<number>, Set<number>]> {
        const db = this.getDb();
        console.debug("CACHE: ", context, eventIndexRange, startIndex, ascending);
        const start = Date.now();

        const [events, expiredEventRanges, missing, dirty] = await iterateCachedEvents(
            await db,
            eventIndexRange,
            context,
            startIndex,
            ascending,
            maxEvents,
            maxMessages,
            maxMissing,
            allowDirty,
            () => this.tryStartExpiredEventSweeper(),
        );

        if (missing.size === 0) {
            console.debug("CACHE: hit: ", events.length, Date.now() - start);
        } else {
            console.debug("CACHE: miss: ", missing);
        }

        return [
            {
                events,
                expiredEventRanges,
                latestEventIndex: undefined,
            },
            missing,
            dirty,
        ];
    }

    async getCachedEventsWindowByMessageIndex(
        eventIndexRange: IndexRange,
        context: MessageContext,
        messageIndex: number,
        maxEvents = MAX_EVENTS,
        maxMessages = MAX_MESSAGES,
        maxMissing = 50,
        allowDirty = true,
    ): Promise<[EventsSuccessResult<ChatEvent>, Set<number>, Set<number>, boolean]> {
        const eventIndex = await this.getNearestCachedEventIndexForMessageIndex(
            context,
            messageIndex,
        );

        if (eventIndex === undefined) {
            return [emptyEventsResponse(), new Set(), new Set(), true];
        }

        const [events, missing, dirty] = await this.getCachedEventsWindow(
            eventIndexRange,
            context,
            eventIndex,
            maxEvents,
            maxMessages,
            maxMissing,
            allowDirty,
        );

        return [events, missing, dirty, false];
    }

    async getCachedEventsWindow(
        eventIndexRange: IndexRange,
        context: MessageContext,
        startIndex: number,
        maxEvents = MAX_EVENTS,
        maxMessages = MAX_MESSAGES,
        maxMissing = 50,
        allowDirty = true,
    ): Promise<[EventsSuccessResult<ChatEvent>, Set<number>, Set<number>]> {
        const db = this.getDb();
        console.debug("CACHE: window: ", eventIndexRange, startIndex);
        const start = Date.now();
        const resolvedDb = await db;

        const promises = [] as Promise<
            [EventWrapper<ChatEvent>[], ExpiredEventsRange[], Set<number>, Set<number>]
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
                    allowDirty,
                    () => this.tryStartExpiredEventSweeper(),
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
                    allowDirty,
                    () => this.tryStartExpiredEventSweeper(),
                ),
            );
        }

        const results: EventsSuccessResult<ChatEvent> = emptyEventsResponse();
        const combinedMissing = new Set<number>();
        const combinedDirty = new Set<number>();
        for (const [events, expiredEventRanges, missing, dirty] of await Promise.all(promises)) {
            events.forEach((e) => results.events.push(e));
            expiredEventRanges.forEach((r) => results.expiredEventRanges.push(r));
            missing.forEach((m) => combinedMissing.add(m));
            dirty.forEach((d) => combinedDirty.add(d));
        }

        if (combinedMissing.size === 0) {
            console.debug("CACHE: hit: ", results.events.length, Date.now() - start);
        }

        return [results, combinedMissing, combinedDirty];
    }

    async getCachedEventsByIndex(
        eventIndexes: number[],
        context: MessageContext,
        allowDirty = true,
    ): Promise<[EventsSuccessResult<ChatEvent>, Set<number>, Set<number>]> {
        const events: EventWrapper<ChatEvent>[] = [];
        const expiredEventRanges: ExpiredEventsRange[] = [];
        const missing = new Set<number>();
        const dirty = new Set<number>();
        const resolvedDb = await this.getDb();
        const now = Date.now();
        await Promise.all(
            eventIndexes.map(async (idx) => {
                const evt = await getCachedEventByIndex(
                    resolvedDb,
                    idx,
                    context,
                    now,
                    allowDirty,
                    () => this.tryStartExpiredEventSweeper(),
                );
                if (evt === undefined) {
                    missing.add(idx);
                } else if (evt.kind === "event") {
                    events.push(convertCachedEvent(evt));
                    if (evt.dirty) {
                        dirty.add(evt.index);
                    }
                } else {
                    expiredEventRanges.push(evt);
                }
            }),
        );
        return [
            {
                events,
                expiredEventRanges,
                latestEventIndex: undefined,
            },
            missing,
            dirty,
        ];
    }

    async getNearestCachedEventIndexForMessageIndex(
        context: MessageContext,
        messageIndex: number,
        iterations = 0,
    ): Promise<number | undefined> {
        const eventIndex = await this.getCachedEventIndexByMessageIndex(context, messageIndex);
        if (eventIndex === undefined && iterations === 0 && messageIndex > 0) {
            console.debug(
                "EV: we didn't find the event index for ",
                messageIndex,
                " recursing to look for event index for ",
                messageIndex - 1,
            );
            return this.getNearestCachedEventIndexForMessageIndex(
                context,
                messageIndex - 1,
                iterations + 1,
            );
        }
        return eventIndex;
    }

    private async getCachedEventIndexByMessageIndex(
        context: MessageContext,
        messageIndex: number,
    ): Promise<number | undefined> {
        const store =
            context.threadRootMessageIndex !== undefined ? "thread_events" : "chat_events";
        const cacheKey = createCacheKey(context, messageIndex);
        const cacheKeyUpperBound = createCacheKey(context, MAX_INDEX);
        const resolvedDb = await this.getDb();

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

    async removeFailedMessage(
        chatId: ChatIdentifier,
        messageId: bigint,
        threadRootMessageIndex?: number,
    ): Promise<void> {
        const store =
            threadRootMessageIndex !== undefined
                ? "failed_thread_messages"
                : "failed_chat_messages";
        (await this.getDb()).delete(
            store,
            createFailedCacheKey({ chatId, threadRootMessageIndex }, messageId),
        );
    }

    async recordFailedMessage<T extends Message>(
        chatId: ChatIdentifier,
        event: EventWrapper<T>,
        threadRootMessageIndex?: number,
    ): Promise<void> {
        if (!canRetryMessage(event.event.content)) {
            return;
        }

        const store =
            threadRootMessageIndex !== undefined
                ? "failed_thread_messages"
                : "failed_chat_messages";
        const key = createFailedCacheKey({ chatId, threadRootMessageIndex }, event.event.messageId);
        (await this.getDb()).put(
            store,
            {
                ...makeSerialisable<T>(event, chatId, false, threadRootMessageIndex),
                messageKey: key,
            },
            key,
        );
    }

    async loadFailedMessages(): Promise<MessageContextMap<Record<string, EventWrapper<Message>>>> {
        const chatMessages = await (await this.getDb()).getAll("failed_chat_messages");
        const threadMessages = await (await this.getDb()).getAll("failed_thread_messages");
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

    async setCachedEvents(
        chatId: ChatIdentifier,
        resp: EventsResponse<ChatEvent>,
        threadRootMessageIndex: number | undefined,
    ): Promise<void> {
        if (!isSuccessfulEventsResponse(resp)) return;
        const store = threadRootMessageIndex !== undefined ? "thread_events" : "chat_events";

        const tx = (await this.getDb()).transaction([store], "readwrite", {
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

        if (resp.expiredEventRanges.length > 0) {
            for (const range of resp.expiredEventRanges) {
                const boundaryKeys = [
                    createCacheKey({ chatId, threadRootMessageIndex }, range.start),
                ];
                if (range.start !== range.end) {
                    boundaryKeys.push(
                        createCacheKey({ chatId, threadRootMessageIndex }, range.end),
                    );
                }

                promises.push(...boundaryKeys.map((k) => eventStore.put(range, k).then((_) => {})));

                if (range.start < range.end - 1) {
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

    async updateCachedProposalTallies(
        chatId: ChatIdentifier,
        tallies: [number, Tally][],
    ): Promise<EventWrapper<Message>[]> {
        const tx = (await this.getDb()).transaction(["chat_events"], "readwrite", {
            durability: "relaxed",
        });
        const eventStore = tx.objectStore("chat_events");

        const messages: EventWrapper<Message>[] = [];
        const promises: Promise<void>[] = tallies.map(([eventIndex, tally]) => {
            const cacheKey = createCacheKey({ chatId }, eventIndex);
            return eventStore
                .get(cacheKey)
                .then((event) => {
                    if (
                        event?.kind === "event" &&
                        event.event.kind === "message" &&
                        event.event.content.kind === "proposal_content"
                    ) {
                        const updated =
                            tally.timestamp > event.event.content.proposal.tally.timestamp;

                        messages.push(event as EventWrapper<Message>);

                        if (updated) {
                            event.event.content.proposal.tally = tally;
                            return eventStore.put(event, cacheKey);
                        }
                    }
                })
                .then((_) => {});
        });
        await Promise.all(promises);
        await tx.done;
        return messages;
    }

    setCachedMessageFromSendResponse(
        chatId: ChatIdentifier,
        sentEvent: EventWrapper<Message>,
        threadRootMessageIndex?: number,
    ): ([resp, message]: [SendMessageResponse, Message]) => [SendMessageResponse, Message] {
        return ([resp, message]: [SendMessageResponse, Message]) => {
            if (resp.kind !== "success" && resp.kind !== "transfer_success") {
                this.recordFailedMessage(chatId, sentEvent, threadRootMessageIndex);
                return [resp, message];
            }

            const event = messageToEvent(message, resp);

            this.setCachedMessageIfNotExists(chatId, event, threadRootMessageIndex);

            return [resp, event.event];
        };
    }

    async setCachedMessageIfNotExists(
        chatId: ChatIdentifier,
        messageEvent: EventWrapper<Message>,
        threadRootMessageIndex?: number,
    ): Promise<void> {
        const key = createCacheKey({ chatId, threadRootMessageIndex }, messageEvent.index);
        const store = threadRootMessageIndex !== undefined ? "thread_events" : "chat_events";
        const tx = (await this.getDb()).transaction([store], "readwrite", {
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

    getCachePrimerEventIndexes(): Promise<Record<string, number>> {
        return readAll(this.getDb(), "cachePrimer");
    }

    async setCachePrimerEventIndex(
        chatId: ChatIdentifier,
        eventIndexLoadedUpTo: number,
    ): Promise<void> {
        const key = chatIdentifierToString(chatId);
        const tx = (await this.getDb()).transaction(["cachePrimer"], "readwrite", {
            durability: "relaxed",
        });
        const store = tx.objectStore("cachePrimer");
        const existing = await store.get(key);
        if (existing === undefined || existing < eventIndexLoadedUpTo) {
            await store.put(eventIndexLoadedUpTo, key);
        }
        await tx.done;
    }

    async getCachedCommunityDetails(communityId: string): Promise<CommunityDetails | undefined> {
        return (await this.getDb()).get("community_details", communityId);
    }

    async getCachedGroupDetails(chatId: string): Promise<GroupChatDetails | undefined> {
        return (await this.getDb()).get("group_details", chatId);
    }

    async setCachedCommunityDetails(
        communityId: string,
        communityDetails: CommunityDetails,
    ): Promise<void> {
        await (await this.getDb()).put("community_details", communityDetails, communityId);
    }

    async setCachedGroupDetails(chatId: string, groupDetails: GroupChatDetails): Promise<void> {
        await (await this.getDb()).put("group_details", groupDetails, chatId);
    }

    async loadMessagesByMessageIndex(
        chatId: ChatIdentifier,
        threadRootMessageIndex: number | undefined,
        messagesIndexes: number[],
    ): Promise<{
        messageEvents: EventWrapper<Message>[];
        missing: Set<number>;
        dirty: Set<number>;
    }> {
        const store = threadRootMessageIndex !== undefined ? "thread_events" : "chat_events";
        const resolvedDb = await this.getDb();

        const messages: EventWrapper<Message>[] = [];
        const missing: Set<number> = new Set();
        const dirty: Set<number> = new Set();

        await Promise.all<Message | undefined>(
            messagesIndexes.map(async (msgIdx) => {
                const cacheKey = createCacheKey({ chatId, threadRootMessageIndex }, msgIdx);

                const evt = await resolvedDb.getFromIndex(store, "messageIdx", cacheKey);
                if (evt?.kind === "event" && evt.event.kind === "message") {
                    messages.push(convertCachedEvent(evt as EnhancedWrapper<Message>));
                    if (evt.dirty) {
                        dirty.add(evt.index);
                    }
                    return evt.event;
                }
                missing.add(msgIdx);
                return undefined;
            }),
        );

        return {
            messageEvents: messages,
            missing,
            dirty,
        };
    }

    async getCachedPublicProfile(userId: string): Promise<PublicProfile | undefined> {
        return (await this.getDb()).get("publicProfile", userId);
    }

    setCachedPublicProfile(userId: string, profile: PublicProfile): void {
        this.getDb().then((db) => db.put("publicProfile", profile, userId));
    }

    async getCachedCurrentUser(): Promise<CreatedUser | undefined> {
        return (await this.getDb()).get("currentUser", this.principalString);
    }

    async mergeCachedCurrentUser(updated: CurrentUserSummary): Promise<void> {
        const current = await this.getCachedCurrentUser();
        if (current) {
            const merged = updateCreatedUser(current, updated);
            (await this.getDb()).put("currentUser", merged, this.principalString);
        }
    }

    setCachedCurrentUser(user: CreatedUser): void {
        this.getDb().then((db) => db.put("currentUser", user, this.principalString));
    }

    async setCurrentUserDiamondStatusInCache(
        diamondStatus: DiamondMembershipStatus,
    ): Promise<void> {
        const user = await this.getCachedCurrentUser();
        if (user === undefined) return;
        (await this.getDb()).put("currentUser", { ...user, diamondStatus }, this.principalString);
    }

    async getLocalUserIndexForUser(userId: string): Promise<string | undefined> {
        return (await this.getDb()).get("localUserIndex", userId);
    }

    async cacheLocalUserIndexForUser(userId: string, localUserIndex: string): Promise<string> {
        (await this.getDb()).put("localUserIndex", localUserIndex, userId);
        return localUserIndex;
    }

    async clearCache(): Promise<void> {
        const name = `openchat_db_${this.principalString}`;
        try {
            (await this.getDb()).close();
            await deleteDB(name);
            console.log("deleted db: ", name);
        } catch (err) {
            console.error("Unable to delete db: ", name, err);
        }
    }

    async getCachedExternalAchievements(): Promise<
        { lastUpdated: bigint; achievements: ExternalAchievement[] } | undefined
    > {
        return (await this.getDb()).get("externalAchievements", "value");
    }

    setCachedExternalAchievements(lastUpdated: bigint, achievements: ExternalAchievement[]): void {
        this.getDb().then((db) =>
            db.put("externalAchievements", { lastUpdated, achievements }, "value"),
        );
    }

    async getActivityFeedEvents(): Promise<MessageActivityEvent[]> {
        const result = await (await this.getDb()).get("activityFeed", "value");
        return result ?? [];
    }

    setActivityFeedEvents(activity: MessageActivityEvent[]): void {
        this.getDb().then((db) => db.put("activityFeed", activity, "value"));
    }

    tryStartExpiredEventSweeper() {
        if (this.expiredEventSweeperJob !== undefined) return;
        this.expiredEventSweeperJob = setTimeout(() => this.runExpiredEventSweeper(), 5000);
    }

    async runExpiredEventSweeper() {
        const db = this.getDb();
        if (db === undefined) return;
        const tx = (await db).transaction(["chat_events", "thread_events"], "readwrite");
        try {
            const eventsStore = tx.objectStore("chat_events");
            const threadEventsStore = tx.objectStore("thread_events");
            const index = eventsStore.index("expiresAt");
            const batchSize = 100;
            const expiredKeys = await index.getAllKeys(
                IDBKeyRange.upperBound(Date.now()),
                batchSize,
            );

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
                    const threadKey = value.messageKey.replace(/_0+/, "_");
                    promises.push(
                        threadEventsStore.delete(
                            IDBKeyRange.bound(threadKey + "_", threadKey + "_Z"),
                        ),
                    );
                }

                await Promise.all(promises);
            }

            await Promise.all(expiredKeys.map(deleteKey));
            await tx.done;

            this.expiredEventSweeperJob = undefined;

            if (expiredKeys.length === batchSize) {
                this.tryStartExpiredEventSweeper();
            }
        } catch {
            tx.abort();
        }
    }
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

// we need to strip out the blobData promise from any media content because that cannot be serialised
function makeSerialisable<T extends ChatEvent>(
    ev: EventWrapper<T>,
    chatId: ChatIdentifier,
    removeBlobs: boolean,
    threadRootMessageIndex?: number,
): EnhancedWrapper<T> {
    if (ev.event.kind !== "message") {
        return { ...ev, kind: "event", chatId: { ...chatId }, messageKey: undefined };
    }

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
    const blob = new Blob([data.slice().buffer], options);
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
                    winnerCount: 0,
                    userIsWinner: false,
                    token: message.content.transfer.token,
                    endDate: message.content.endDate,
                    caption: message.content.caption,
                    diamondOnly: message.content.diamondOnly,
                    lifetimeDiamondOnly: message.content.lifetimeDiamondOnly,
                    uniquePersonOnly: message.content.uniquePersonOnly,
                    streakOnly: message.content.streakOnly,
                    requiresCaptcha: message.content.requiresCaptcha,
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

function convertCachedEvent<T extends ChatEvent>(event: EnhancedWrapper<T>): EventWrapper<T> {
    return {
        event: event.event,
        index: event.index,
        timestamp: event.timestamp,
        expiresAt: event.expiresAt,
    };
}

async function getCachedEventByIndex(
    db: IDBPDatabase<ChatSchema>,
    eventIndex: number,
    context: MessageContext,
    now: number,
    allowDirty: boolean,
    onExpiry: () => void,
): Promise<EnhancedWrapper<ChatEvent> | ExpiredEventsRange | undefined> {
    const storeName =
        context.threadRootMessageIndex === undefined ? "chat_events" : "thread_events";
    const key = createCacheKey(context, eventIndex);
    const upperBound = createCacheKey(context, MAX_INDEX);

    const event = processEventExpiry(
        await db.get(storeName, IDBKeyRange.bound(key, upperBound)),
        now,
        onExpiry,
    );

    if (
        (event?.kind === "event" && event.index === eventIndex && (!event.dirty || allowDirty)) ||
        (event?.kind === "expired_events_range" && event.start <= eventIndex)
    ) {
        return event;
    }
    return undefined;
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
    allowDirty: boolean,
    onExpiry: () => void,
): Promise<[EventWrapper<ChatEvent>[], ExpiredEventsRange[], Set<number>, Set<number>]> {
    const bound = ascending ? eventIndexRange[1] : eventIndexRange[0];
    const iterator = await EventsIterator.create(
        db,
        context,
        startIndex,
        ascending,
        bound,
        onExpiry,
    );

    const events: EventWrapper<ChatEvent>[] = [];
    const expiredEventRanges: ExpiredEventsRange[] = [];
    const missing = new Set<number>();
    const dirty = new Set<number>();
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
                if (missing.size + dirty.size > maxMissing) {
                    break;
                }
            }

            expectedNextIndex = endIndex + 1;
        } else {
            const [startIndex, endIndex] =
                next.kind === "event" ? [next.index, next.index] : [next.end, next.start];

            for (let i = expectedNextIndex; i > startIndex; i--) {
                missing.add(i);
                if (missing.size + dirty.size > maxMissing) {
                    break;
                }
            }

            expectedNextIndex = endIndex - 1;
        }

        if (next.kind === "event") {
            if (next.dirty) {
                if (allowDirty) {
                    dirty.add(next.index);
                } else {
                    missing.add(next.index);
                    continue;
                }
            }
            events.push(convertCachedEvent(next));

            if (next.event.kind === "message") {
                if (++messageCount == maxMessages) {
                    break;
                }
            }
        } else {
            expiredEventRanges.push(next);
        }
    }

    return [events, expiredEventRanges, missing, dirty];
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
        return right.start <= left.end + 1;
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
        private readonly onExpiry?: () => void,
    ) {
        this.now = Date.now();
        this.current = processEventExpiry(cursor?.value, this.now, this.onExpiry);
    }

    static async create(
        db: IDBPDatabase<ChatSchema>,
        messageContext: MessageContext,
        startIndex: number,
        ascending: boolean,
        bound: number,
        onExpiry?: () => void,
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

        return new EventsIterator(cursor, () => transaction.done, onExpiry);
    }

    async getNext(): Promise<EnhancedWrapper<ChatEvent> | ExpiredEventsRange | undefined> {
        const current = this.current;
        if (current === undefined) {
            return undefined;
        }

        await this.advance();

        const next = processEventExpiry(this.cursor?.value, this.now, this.onExpiry);

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
    onExpiry?: () => void,
): EnhancedWrapper<ChatEvent> | ExpiredEventsRange | undefined {
    if (
        event === undefined ||
        event.kind === "expired_events_range" ||
        event.expiresAt === undefined ||
        event.expiresAt > now
    ) {
        return event;
    }

    onExpiry?.();

    return {
        kind: "expired_events_range",
        start: event.index,
        end: event.index,
    };
}
