import { isPreviewing, MAX_MESSAGES, MAX_MISSING } from "../domain/chat/chat.utils";
import DRange from "drange";
import { openDB, DBSchema, IDBPDatabase } from "idb";
import type {
    ChatEvent,
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
    SerializableMergedUpdatesResponse,
} from "../domain/chat/chat";
import type { DirectNotification, GroupNotification } from "../domain/notifications";
import type { UserSummary } from "../domain/user/user";
import { rollbar } from "./logging";
import { UnsupportedValueError } from "./error";
import { missingUserIds } from "domain/user/user.utils";

const CACHE_VERSION = 24;

export type Database = Promise<IDBPDatabase<ChatSchema>>;

export interface ChatSchema extends DBSchema {
    chats: {
        key: string;
        value: SerializableMergedUpdatesResponse;
    };

    chat_events: {
        key: string;
        value: EventWrapper<ChatEvent>;
    };

    group_details: {
        key: string;
        value: GroupChatDetails;
    };

    message_index_event_index: {
        key: string; // chatId_messageIndex
        value: number;
    };

    // this is obsolete and preserved only to keep the type checker happy
    media_data: {
        key: string;
        value: Uint8Array;
    };

    soft_disabled: {
        key: string;
        value: boolean;
    };

    users: {
        key: string;
        value: UserSummary;
    };
}

function padMessageIndex(i: number): string {
    return i.toString().padStart(10, "0");
}

export function cachingLocallyDisabled(): boolean {
    return !!localStorage.getItem("openchat_nocache");
}

export function createCacheKey(chatId: string, index: number): string {
    return `${chatId}_${padMessageIndex(index)}`;
}

export function openCache(principal: string): Database | undefined {
    if (process.env.NODE_ENV === "test" || !process.env.CLIENT_CACHING) {
        return undefined;
    }
    try {
        return openDB<ChatSchema>(`openchat_db_${principal}`, CACHE_VERSION, {
            upgrade(db, _oldVersion, _newVersion) {
                try {
                    if (db.objectStoreNames.contains("chat_events")) {
                        db.deleteObjectStore("chat_events");
                    }
                    if (db.objectStoreNames.contains("chats")) {
                        db.deleteObjectStore("chats");
                    }
                    if (db.objectStoreNames.contains("group_details")) {
                        db.deleteObjectStore("group_details");
                    }
                    if (db.objectStoreNames.contains("media_data")) {
                        db.deleteObjectStore("media_data");
                    }
                    if (db.objectStoreNames.contains("message_index_event_index")) {
                        db.deleteObjectStore("message_index_event_index");
                    }
                    if (db.objectStoreNames.contains("users")) {
                        db.deleteObjectStore("users");
                    }
                    db.createObjectStore("chat_events");
                    db.createObjectStore("chats");
                    db.createObjectStore("group_details");
                    db.createObjectStore("message_index_event_index");
                    db.createObjectStore("users");
                    if (!db.objectStoreNames.contains("soft_disabled")) {
                        db.createObjectStore("soft_disabled");
                    }
                } catch (err) {
                    rollbar.error("Unable to upgrade indexDB", err as Error);
                }
            },
        });
    } catch (err) {
        rollbar.error("Unable to open indexDB", err as Error);
    }
}

export async function removeCachedChat(
    db: Database,
    userId: string,
    chatId: string
): Promise<void> {
    const fromCache = await getCachedChats(db, userId);
    if (fromCache !== undefined) {
        fromCache.chatSummaries = fromCache.chatSummaries.filter((c) => c.chatId !== chatId);
        await setCachedChats(db, userId)(fromCache);
    }
}

export async function getCachedChats(
    db: Database,
    userId: string
): Promise<MergedUpdatesResponse | undefined> {
    const fromCache = (await (await db).get("chats", userId)) as
        | SerializableMergedUpdatesResponse
        | undefined;
    return fromCache
        ? {
              ...fromCache,
              chatSummaries: fromCache.chatSummaries.map((c) => {
                  if (c.kind === "direct_chat") {
                      return {
                          ...c,
                          readByMe: indexRangesToDRange(c.readByMe),
                          readByThem: indexRangesToDRange(c.readByThem),
                      };
                  } else {
                      return {
                          ...c,
                          readByMe: indexRangesToDRange(c.readByMe),
                      };
                  }
              }),
          }
        : undefined;
}

export function setCachedChats(
    db: Database,
    userId: string
): (data: MergedUpdatesResponse) => Promise<MergedUpdatesResponse> {
    return async (data: MergedUpdatesResponse) => {
        if (!data.wasUpdated) {
            return data;
        }

        const latestMessages: Record<string, EventWrapper<Message>> = {};

        // irritating hoop jumping to keep typescript happy here
        const serialisable = data.chatSummaries
            .filter((c) => !isPreviewing(c))
            .map((c) => {
                const latestMessage = c.latestMessage
                    ? makeSerialisable(c.latestMessage, c.chatId)
                    : undefined;

                if (latestMessage) {
                    latestMessages[c.chatId] = latestMessage;
                }

                if (c.kind === "direct_chat") {
                    return {
                        ...c,
                        readByMe: drangeToIndexRanges(c.readByMe),
                        readByThem: drangeToIndexRanges(c.readByThem),
                        latestMessage,
                    };
                }

                if (c.kind === "group_chat") {
                    return {
                        ...c,
                        readByMe: drangeToIndexRanges(c.readByMe),
                        latestMessage,
                    };
                }

                throw new UnsupportedValueError("Unrecognised chat type", c);
            });

        const tx = (await db).transaction(
            ["chats", "chat_events", "message_index_event_index"],
            "readwrite"
        );
        const chatsStore = tx.objectStore("chats");
        const eventStore = tx.objectStore("chat_events");
        const mapStore = tx.objectStore("message_index_event_index");

        const promises: Promise<string | void>[] = [
            chatsStore.put(
                {
                    wasUpdated: true,
                    chatSummaries: serialisable,
                    timestamp: data.timestamp,
                    blockedUsers: data.blockedUsers,
                    avatarIdUpdate: undefined,
                    affectedEvents: {},
                },
                userId
            ),
            ...Object.entries(latestMessages).flatMap(([chatId, message]) => [
                eventStore.put(message, createCacheKey(chatId, message.index)),
                mapStore.put(message.index, `${chatId}_${message.event.messageIndex}`),
            ]),
            ...Object.entries(data.affectedEvents)
                .flatMap(([chatId, indexes]) => indexes.map((i) => createCacheKey(chatId, i)))
                .map((key) => eventStore.delete(key)),
        ];

        await Promise.all(promises);
        await tx.done;

        return data;
    };
}

export async function getCachedEventsWindow<T extends ChatEvent>(
    db: Database,
    eventIndexRange: IndexRange,
    chatId: string,
    messageIndex: number
): Promise<[EventsSuccessResult<T>, Set<number>]> {
    console.log("cache: window: ", eventIndexRange, messageIndex);
    const start = Date.now();
    const [events, missing] = await aggregateEventsWindow<T>(
        db,
        eventIndexRange,
        chatId,
        messageIndex
    );

    if (missing.size === 0) {
        console.log("cache hit: ", events, Date.now() - start);
    }

    events.sort((a, b) => a.index - b.index);

    return [{ events, affectedEvents: [] }, missing];
}

function loadEventByIndex<T extends ChatEvent>(
    db: IDBPDatabase<ChatSchema>,
    chatId: string,
    idx: number
): Promise<EventWrapper<T> | undefined> {
    const key = createCacheKey(chatId, idx);
    return db.get("chat_events", key) as Promise<EventWrapper<T> | undefined>;
}

async function aggregateEventsWindow<T extends ChatEvent>(
    db: Database,
    [min, max]: IndexRange,
    chatId: string,
    middleMessageIndex: number
): Promise<[EventWrapper<T>[], Set<number>]> {
    let numMessages = 0;
    const events: EventWrapper<T>[] = [];
    const resolvedDb = await db;
    const missing = new Set<number>();

    const eventIndex = await resolvedDb.get(
        "message_index_event_index",
        `${chatId}_${middleMessageIndex}`
    );

    if (eventIndex === undefined) {
        console.log("cache miss: could not find the starting event index for the message window");
        return [[], missing];
    }

    let descIdx = eventIndex;
    let ascIdx = eventIndex + 1;

    while (numMessages < MAX_MESSAGES && missing.size < MAX_MISSING) {
        // if we have exceeded the range of this chat then we have succeeded
        if (ascIdx > max && descIdx < min) {
            return [events, missing];
        }

        if (ascIdx <= max) {
            const ascEvt: EventWrapper<T> | undefined = await loadEventByIndex(
                resolvedDb,
                chatId,
                ascIdx
            );
            if (ascEvt !== undefined) {
                events.push(ascEvt);
                if (ascEvt.event.kind === "message") {
                    numMessages += 1;
                }
            } else {
                console.log("Couldn't find index: ", ascIdx);
                missing.add(ascIdx);
            }
            ascIdx += 1;
        }

        if (descIdx >= min) {
            const descEvt: EventWrapper<T> | undefined = await loadEventByIndex(
                resolvedDb,
                chatId,
                descIdx
            );

            if (descEvt !== undefined) {
                events.push(descEvt);
                if (descEvt.event.kind === "message") {
                    numMessages += 1;
                }
            } else {
                console.log("Couldn't find index: ", descIdx);
                missing.add(descIdx);
            }
            descIdx -= 1;
        }
    }

    return [events, missing];
}

async function aggregateEvents<T extends ChatEvent>(
    db: Database,
    [min, max]: IndexRange,
    chatId: string,
    startIndex: number,
    ascending: boolean
): Promise<[EventWrapper<T>[], Set<number>]> {
    let numMessages = 0;
    let currentIndex = startIndex;
    const events: EventWrapper<T>[] = [];
    const resolvedDb = await db;
    const missing = new Set<number>();

    // keep iterating until we get "enough" messages or we go beyond the range of the chat or we get a full page of missing messages
    // return all the events that we found and the indexes of any that we did not find
    while (numMessages < MAX_MESSAGES && missing.size < MAX_MISSING) {
        // if we have exceeded the range of this chat then we have succeeded
        if ((currentIndex > max && ascending) || (currentIndex < min && !ascending)) {
            return [events, missing];
        }

        const key = createCacheKey(chatId, currentIndex);
        const evt = await resolvedDb.get("chat_events", key);
        if (evt) {
            if (evt.event.kind === "message") {
                numMessages += 1;
            }
            events.push(evt as EventWrapper<T>);
        } else {
            console.log("Couldn't find key: ", key);
            // as soon as we draw a blank, bale out
            // break;
            // let's continue aggregating events and just track the indexes that we couldn't find
            missing.add(currentIndex);
        }

        if (ascending) {
            currentIndex += 1;
        } else {
            currentIndex -= 1;
        }
    }

    return [ascending ? events : events.reverse(), missing];
}

export async function getCachedMessageByIndex<T extends ChatEvent>(
    db: Database,
    eventIndex: number,
    chatId: string
): Promise<EventWrapper<T> | undefined> {
    const key = createCacheKey(chatId, eventIndex);
    return (await db).get("chat_events", key) as Promise<EventWrapper<T> | undefined>;
}

export async function getCachedEventsByIndex<T extends ChatEvent>(
    db: Database,
    eventIndexes: number[],
    chatId: string
): Promise<[EventsSuccessResult<T>, Set<number>]> {
    const missing = new Set<number>();
    const returnedEvents = await Promise.all(
        eventIndexes.map((idx) =>
            getCachedMessageByIndex(db, idx, chatId).then((evt) => {
                if (evt === undefined) {
                    missing.add(idx);
                }
                return evt;
            })
        )
    );
    const events = returnedEvents.filter((evt) => evt !== undefined) as EventWrapper<T>[];
    return [{ events, affectedEvents: [] }, missing];
}

export async function getCachedEvents<T extends ChatEvent>(
    db: Database,
    eventIndexRange: IndexRange,
    chatId: string,
    startIndex: number,
    ascending: boolean
): Promise<[EventsSuccessResult<T>, Set<number>]> {
    console.log("cache: ", eventIndexRange, startIndex, ascending);
    const start = Date.now();
    const [events, missing] = await aggregateEvents<T>(
        db,
        eventIndexRange,
        chatId,
        startIndex,
        ascending
    );

    if (missing.size === 0) {
        console.log("cache hit: ", events.length, Date.now() - start);
    } else {
        console.log("cache miss: ", missing);
    }

    return [{ events, affectedEvents: [] }, missing];
}

export function mergeSuccessResponses<T extends ChatEvent>(
    a: EventsSuccessResult<T>,
    b: EventsSuccessResult<T>
): EventsSuccessResult<T> {
    return {
        events: [...a.events, ...b.events].sort((a, b) => a.index - b.index),
        affectedEvents: [...a.affectedEvents, ...b.affectedEvents],
    };
}

// we need to strip out the blobData promise from any media content because that cannot be serialised
function makeSerialisable<T extends ChatEvent>(
    ev: EventWrapper<T>,
    chatId: string
): EventWrapper<T> {
    if (ev.event.kind !== "message") return ev;

    return {
        ...ev,
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

function drangeToIndexRanges(drange: DRange): IndexRange[] {
    return drange.subranges().map((r) => [r.low, r.high]);
}

function indexRangesToDRange(ranges: IndexRange[]): DRange {
    const drange = new DRange();
    ranges.forEach((r) => drange.add(r[0], r[1]));
    return drange;
}

export function setCachedEvents<T extends ChatEvent>(
    db: Database,
    chatId: string
): (resp: EventsResponse<T>) => Promise<EventsResponse<T>> {
    return async (resp: EventsResponse<T>) => {
        if (resp === "events_failed") return Promise.resolve(resp);
        const tx = (await db).transaction(
            ["chat_events", "message_index_event_index"],
            "readwrite"
        );
        const eventStore = tx.objectStore("chat_events");
        const mapStore = tx.objectStore("message_index_event_index");
        await Promise.all(
            resp.events.concat(resp.affectedEvents).map(async (event) => {
                await eventStore.put(
                    makeSerialisable<T>(event, chatId),
                    createCacheKey(chatId, event.index)
                );
                if (event.event.kind === "message") {
                    await mapStore.put(event.index, `${chatId}_${event.event.messageIndex}`);
                }
            })
        );
        await tx.done;

        return resp;
    };
}

export function setCachedMessageFromSendResponse(
    db: Database,
    chatId: string,
    message: Message
): (resp: SendMessageResponse) => Promise<SendMessageResponse> {
    return async (resp: SendMessageResponse) => {
        if (resp.kind !== "success") return Promise.resolve(resp);

        const event = messageToEvent(message, resp);

        await setCachedMessage(db, chatId, event);

        return resp;
    };
}

export async function setCachedMessageFromNotification(
    notification: DirectNotification | GroupNotification
): Promise<void> {
    if (!process.env.CLIENT_CACHING) return;

    if (db === undefined) {
        throw new Error("Unable to open indexDB, cannot set message from notification");
    }

    const chatId =
        notification.kind === "group_notification" ? notification.chatId : notification.sender;

    await setCachedMessage(db, chatId, notification.message);
}

async function setCachedMessage(
    db: Database,
    chatId: string,
    messageEvent: EventWrapper<Message>
): Promise<void> {
    const tx = (await db).transaction(["chat_events", "message_index_event_index"], "readwrite");
    const eventStore = tx.objectStore("chat_events");
    const mapStore = tx.objectStore("message_index_event_index");
    await Promise.all([
        eventStore.put(
            makeSerialisable(messageEvent, chatId),
            createCacheKey(chatId, messageEvent.index)
        ),
        mapStore.put(messageEvent.index, `${chatId}_${messageEvent.event.messageIndex}`),
    ]);
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

export async function overwriteCachedEvents<T extends ChatEvent>(
    chatId: string,
    events: EventWrapper<T>[]
): Promise<void> {
    if (!process.env.CLIENT_CACHING) return;

    if (db === undefined) {
        throw new Error("Unable to open indexDB, cannot overwrite cache entries");
    }
    const tx = (await db).transaction("chat_events", "readwrite");
    const store = tx.objectStore("chat_events");
    await Promise.all(
        events.map((event) =>
            store.put(makeSerialisable<T>(event, chatId), createCacheKey(chatId, event.index))
        )
    );
    await tx.done;
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
        const tx = (await db).transaction("soft_disabled", "readwrite");
        const store = tx.objectStore("soft_disabled");
        await store.put(value, "soft_disabled");
        await tx.done;
    }
}

export async function getSoftDisabled(): Promise<boolean> {
    if (db !== undefined) {
        const res = await (await db).get("soft_disabled", "soft_disabled");
        return res ?? false;
    }
    return false;
}

export async function getCachedUsers(db: Database, userIds: string[]): Promise<UserSummary[]> {
    const resolvedDb = await db;

    const fromCache = await Promise.all(userIds.map((u) => resolvedDb.get("users", u)));

    return fromCache.reduce((users, next) => {
        if (next !== undefined) users.push(next);
        return users;
    }, [] as UserSummary[]);
}

export async function setCachedUsers(db: Database, users: UserSummary[]): Promise<void> {
    const tx = (await db).transaction("users", "readwrite");
    const store = tx.objectStore("users");

    await Promise.all(users.map((u) => store.put(u, u.userId)));
    await tx.done;
}

let db: Database | undefined;

export function getDb(): Database | undefined {
    return db;
}

export function initDb(principal: string): Database | undefined {
    db = openCache(principal);
    return db;
}

export function closeDb(): void {
    db = undefined;
}

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
            const eventIdx = await resolvedDb.get(
                "message_index_event_index",
                `${chatId}_${msgIdx}`
            );
            if (eventIdx === undefined) {
                missing.add(msgIdx);
                return undefined;
            }
            const evt: EventWrapper<ChatEvent> | undefined = await loadEventByIndex(
                resolvedDb,
                chatId,
                eventIdx
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
