import DRange from "drange";
import { openDB, DBSchema, IDBPDatabase } from "idb";
import type {
    ChatEvent,
    EventsResponse,
    EventWrapper,
    IndexRange,
    MergedUpdatesResponse,
    Message,
    SendMessageResponse,
    SendMessageSuccess,
    SerializableMergedUpdatesResponse,
} from "../domain/chat/chat";
import { rollbar } from "./logging";

export const MAX_MSGS = 30;

export type Database = Promise<IDBPDatabase<ChatSchema>>;

const blobbyContentTypes = ["file_content", "image_content", "video_content", "audio_content"];

export interface ChatSchema extends DBSchema {
    chats: {
        key: string;
        value: SerializableMergedUpdatesResponse;
    };

    chat_events: {
        key: string;
        value: EventWrapper<ChatEvent>;
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
}

function padMessageIndex(i: number): string {
    return i.toString().padStart(10, "0");
}

export function createCacheKey(chatId: string, index: number): string {
    return `${chatId}_${padMessageIndex(index)}`;
}

export function openCache(principal: string): Database | undefined {
    if (process.env.NODE_ENV === "test" || !process.env.CLIENT_CACHING) {
        return undefined;
    }
    try {
        return openDB<ChatSchema>(`openchat_db_${principal}`, 12, {
            upgrade(db, _oldVersion, _newVersion) {
                try {
                    if (db.objectStoreNames.contains("chat_events")) {
                        db.deleteObjectStore("chat_events");
                    }
                    if (db.objectStoreNames.contains("media_data")) {
                        db.deleteObjectStore("media_data");
                    }
                    if (db.objectStoreNames.contains("chats")) {
                        db.deleteObjectStore("chats");
                    }
                    if (db.objectStoreNames.contains("message_index_event_index")) {
                        db.deleteObjectStore("message_index_event_index");
                    }
                    db.createObjectStore("chat_events");
                    db.createObjectStore("chats");
                    db.createObjectStore("message_index_event_index");
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
        // irritating hoop jumping to keep typescript happy here
        const serialisable = data.chatSummaries.map((c) => {
            if (c.kind === "direct_chat") {
                return {
                    ...c,
                    readByMe: drangeToIndexRanges(c.readByMe),
                    readByThem: drangeToIndexRanges(c.readByThem),
                    latestMessage: c.latestMessage ? makeSerialisable(c.latestMessage) : undefined,
                };
            }
            if (c.kind === "group_chat") {
                return {
                    ...c,
                    readByMe: drangeToIndexRanges(c.readByMe),
                    latestMessage: c.latestMessage ? makeSerialisable(c.latestMessage) : undefined,
                };
            }
            return c;
        });
        (await db).put(
            "chats",
            {
                wasUpdated: true,
                chatSummaries: serialisable,
                timestamp: data.timestamp,
                blockedUsers: data.blockedUsers,
            },
            userId
        );
        return data;
    };
}

export async function getCachedEventsWindow<T extends ChatEvent>(
    db: Database,
    eventIndexRange: IndexRange,
    chatId: string,
    messageIndex: number
): Promise<EventsResponse<T> | undefined> {
    console.log("cache: window: ", eventIndexRange, messageIndex);
    const start = Date.now();
    const [complete, events] = await aggregateEventsWindow<T>(
        db,
        eventIndexRange,
        chatId,
        messageIndex
    );

    if (complete) {
        console.log("cache hit: ", events, Date.now() - start);
    }

    events.sort((a, b) => a.index - b.index);

    // if we are retrieving completely from the cache, affectedEvents is always empty
    return complete ? { events, affectedEvents: [] } : undefined;
}

async function loadEventByIndex<T extends ChatEvent>(
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
): Promise<[boolean, EventWrapper<T>[]]> {
    let numMessages = 0;
    const events: EventWrapper<T>[] = [];
    const resolvedDb = await db;

    const eventIndex = await resolvedDb.get(
        "message_index_event_index",
        `${chatId}_${middleMessageIndex}`
    );

    if (eventIndex === undefined) {
        console.log("cache miss: could not find the starting event index for the message window");
        return [false, []];
    }

    let descIdx = eventIndex;
    let ascIdx = eventIndex + 1;

    while (numMessages < MAX_MSGS) {
        // if we have exceeded the range of this chat then we have succeeded
        if (ascIdx > max && descIdx < min) {
            return [true, events];
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
                break;
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
                break;
            }
            descIdx -= 1;
        }
    }

    // todo - events are going to come out in a weird order here but I don't think it matter
    // because I think we sort them later
    return [numMessages >= MAX_MSGS, events];
}

async function aggregateEvents<T extends ChatEvent>(
    db: Database,
    [min, max]: IndexRange,
    chatId: string,
    startIndex: number,
    ascending: boolean
): Promise<[boolean, EventWrapper<T>[]]> {
    let numMessages = 0;
    let currentIndex = startIndex;
    const events: EventWrapper<T>[] = [];
    const resolvedDb = await db;

    while (numMessages < MAX_MSGS) {
        // if we have exceeded the range of this chat then we have succeeded
        if ((currentIndex > max && ascending) || (currentIndex < min && !ascending)) {
            return [true, events];
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
            break;
        }

        if (ascending) {
            currentIndex += 1;
        } else {
            currentIndex -= 1;
        }
    }

    return [numMessages >= MAX_MSGS, ascending ? events : events.reverse()];
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
): Promise<EventsResponse<T> | undefined> {
    const returnedEvents = await Promise.all(
        eventIndexes.map(async (idx) => getCachedMessageByIndex(db, idx, chatId))
    );
    const events = returnedEvents.filter((evt) => evt !== undefined) as EventWrapper<T>[];
    return events.length === eventIndexes.length ? { events, affectedEvents: [] } : undefined;
}

export async function getCachedEvents<T extends ChatEvent>(
    db: Database,
    eventIndexRange: IndexRange,
    chatId: string,
    startIndex: number,
    ascending: boolean
): Promise<EventsResponse<T> | undefined> {
    console.log("cache: ", eventIndexRange, startIndex, ascending);
    const start = Date.now();
    const [complete, events] = await aggregateEvents<T>(
        db,
        eventIndexRange,
        chatId,
        startIndex,
        ascending
    );

    if (complete) {
        console.log("cache hit: ", events.length, Date.now() - start);
    }

    // if we are retrieving completely from the cache, affectedEvents is always empty
    return complete ? { events, affectedEvents: [] } : undefined;
}

// we need to strip out the blobData promise from any media content because that cannot be serialised
function makeSerialisable<T extends ChatEvent>(ev: EventWrapper<T>): EventWrapper<T> {
    if (ev.event.kind !== "message") return ev;

    if (blobbyContentTypes.includes(ev.event.content.kind)) {
        return {
            ...ev,
            event: {
                ...ev.event,
                content: {
                    ...ev.event.content,
                    blobData: undefined,
                },
            },
        };
    }
    return ev;
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
            resp.events.map(async (event) => {
                await eventStore.put(
                    makeSerialisable<T>(event),
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

export function setCachedMessage(
    db: Database,
    chatId: string,
    message: Message
): (resp: SendMessageResponse) => Promise<SendMessageResponse> {
    return async (resp: SendMessageResponse) => {
        if (resp.kind !== "success") return Promise.resolve(resp);

        const event = messageToEvent(message, resp);

        const tx = (await db).transaction(
            ["chat_events", "message_index_event_index"],
            "readwrite"
        );
        const eventStore = tx.objectStore("chat_events");
        const mapStore = tx.objectStore("message_index_event_index");
        await Promise.all([
            eventStore.put(makeSerialisable(event), createCacheKey(chatId, event.index)),
            mapStore.put(event.index, `${chatId}_${event.event.messageIndex}`),
        ]);
        await tx.done;

        return resp;
    };
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
            store.put(makeSerialisable<T>(event), createCacheKey(chatId, event.index))
        )
    );
    await tx.done;
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
