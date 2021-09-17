import { openDB, DBSchema, IDBPDatabase } from "idb";
import type {
    ChatEvent,
    EventsResponse,
    EventWrapper,
    MergedUpdatesResponse,
} from "../domain/chat/chat";
import { blobbyContentTypes } from "../domain/chat/chat.utils";
import { rollbar } from "./logging";

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

export async function getCachedMessages<T extends ChatEvent>(
    db: Database,
    chatId: string,
    fromIndex: number,
    toIndex: number
): Promise<EventsResponse<T> | undefined> {
    const cachedMsgs = await (
        await db
    ).getAll(
        "chat_messages",
        IDBKeyRange.bound(createCacheKey(chatId, fromIndex), createCacheKey(chatId, toIndex))
    );
    console.log("cache", cachedMsgs.length, toIndex - fromIndex);
    if (cachedMsgs.length === toIndex - fromIndex + 1) {
        // the range is inclusive
        console.log("cache hit!");

        // we tell typescript a little white lie here because blobData will be undefined on any MediaContent
        // records
        return { events: cachedMsgs as EventWrapper<T>[] };
    }
}

// we need to strip out the blobData promise from any media content because that cannot be serialised
function makeSerialisable<T extends ChatEvent>(ev: EventWrapper<T>): EventWrapper<T> {
    if (ev.event.kind !== "group_message" && ev.event.kind !== "direct_message") return ev;

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

export const db = openMessageCache();
