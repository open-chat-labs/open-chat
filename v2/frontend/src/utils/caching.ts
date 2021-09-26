import { openDB, DBSchema, IDBPDatabase } from "idb";
import type {
    ChatEvent,
    EventsResponse,
    EventWrapper,
    IndexRange,
    MergedUpdatesResponse,
} from "../domain/chat/chat";
import { blobbyContentTypes } from "../domain/chat/chat.utils";
import { rollbar } from "./logging";

export const MAX_EVENTS = 50;
export const MAX_MSGS = 20;

export type Database = Promise<IDBPDatabase<ChatSchema>>;

export interface ChatSchema extends DBSchema {
    chats: {
        key: "cached_chats";
        value: MergedUpdatesResponse;
    };
    chat_messages: {
        key: string;
        value: EventWrapper<ChatEvent>;
    };

    // this is obsolete and preserved only to keep the type checker happy
    media_data: {
        key: string;
        value: Uint8Array;
    };
}

function padMessageIndex(i: number): string {
    return i.toString().padStart(10, "0");
}

export function createCacheKey(chatId: string, index: number): string {
    return `${chatId}_${padMessageIndex(index)}`;
}

export function openMessageCache(): Database | undefined {
    try {
        return openDB<ChatSchema>("openchat_db", 7, {
            upgrade(db, _oldVersion, _newVersion) {
                try {
                    if (db.objectStoreNames.contains("chat_messages")) {
                        db.deleteObjectStore("chat_messages");
                    }
                    if (db.objectStoreNames.contains("media_data")) {
                        db.deleteObjectStore("media_data");
                    }
                    if (db.objectStoreNames.contains("chats")) {
                        db.deleteObjectStore("chats");
                    }
                    db.createObjectStore("chat_messages");
                    db.createObjectStore("chats");
                } catch (err) {
                    rollbar.error("Unable to upgrade indexDB", err as Error);
                }
            },
        });
    } catch (err) {
        rollbar.error("Unable to open indexDB", err as Error);
    }
}

export async function getCachedChats(db: Database): Promise<MergedUpdatesResponse | undefined> {
    return (await db).get("chats", "cached_chats") as Promise<MergedUpdatesResponse | undefined>;
}

export function setCachedChats(
    db: Database
): (data: MergedUpdatesResponse) => Promise<MergedUpdatesResponse> {
    return async (data: MergedUpdatesResponse) => {
        // irritating hoop jumping to keep typescript happy here
        const serialisable = data.chatSummaries.map((c) => {
            if (c.kind === "direct_chat") {
                return {
                    ...c,
                    latestMessage: c.latestMessage ? makeSerialisable(c.latestMessage) : undefined,
                };
            }
            if (c.kind === "group_chat") {
                return {
                    ...c,
                    latestMessage: c.latestMessage ? makeSerialisable(c.latestMessage) : undefined,
                };
            }
            return c;
        });
        (await db).put(
            "chats",
            {
                chatSummaries: serialisable,
                timestamp: data.timestamp,
                blockedUsers: data.blockedUsers,
            },
            "cached_chats"
        );
        return data;
    };
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

    while (numMessages < MAX_MSGS && events.length < MAX_EVENTS) {
        // if we have exceeded the range of this chat then we have succeeded
        if ((currentIndex > max && ascending) || (currentIndex < min && !ascending)) {
            return [true, events];
        }

        const key = createCacheKey(chatId, currentIndex);
        const evt = await (await db).get("chat_messages", key);
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

    return [numMessages >= MAX_MSGS || events.length >= MAX_EVENTS, events];
}

export async function getCachedMessages<T extends ChatEvent>(
    db: Database,
    eventIndexRange: IndexRange,
    chatId: string,
    startIndex: number,
    ascending: boolean
): Promise<EventsResponse<T> | undefined> {
    console.log("cache: ", eventIndexRange, startIndex, ascending);
    const start = +new Date();
    const [complete, events] = await aggregateEvents<T>(
        db,
        eventIndexRange,
        chatId,
        startIndex,
        ascending
    );

    if (complete) {
        console.log("cache hit: ", events.length, +new Date() - start);
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

export function setCachedMessages<T extends ChatEvent>(
    db: Database,
    chatId: string
): (resp: EventsResponse<T>) => Promise<EventsResponse<T>> {
    return async (resp: EventsResponse<T>) => {
        if (resp === "chat_not_found") return Promise.resolve(resp);
        const tx = (await db).transaction("chat_messages", "readwrite");
        const store = tx.objectStore("chat_messages");
        resp.events.forEach(async (event) => {
            await store.put(makeSerialisable<T>(event), createCacheKey(chatId, event.index));
        });
        await tx.done;
        return resp;
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
    const tx = (await db).transaction("chat_messages", "readwrite");
    const store = tx.objectStore("chat_messages");
    events.forEach(async (event) => {
        await store.put(makeSerialisable<T>(event), createCacheKey(chatId, event.index));
    });
    await tx.done;
}

export const db = openMessageCache();
