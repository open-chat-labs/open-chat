import { openDB, DBSchema, IDBPDatabase } from "idb";
import { dataset_dev } from "svelte/internal";
import type { EventsResponse, EventWrapper } from "../domain/chat/chat";
import { rollbar } from "./logging";

type Database = Promise<IDBPDatabase<ChatSchema>>;

export interface ChatSchema extends DBSchema {
    chat_messages: {
        key: string;
        value: EventWrapper;
    };
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
        return openDB<ChatSchema>("openchat_db", 2, {
            upgrade(db, oldVersion, newVersion) {
                if (oldVersion === 0 && newVersion === 1) {
                    db.createObjectStore("chat_messages");
                }
                if (oldVersion === 1 && newVersion === 2) {
                    db.createObjectStore("media_data");
                }
            },
        });
    } catch (err) {
        rollbar.error("Unable to open indexDB", err);
    }
}

// this returns cached binary data used for media messages etc
export async function getCachedData(db: Database, blobId: bigint): Promise<Uint8Array | undefined> {
    return (await db).get("media_data", blobId.toString());
}

export async function getCachedMessages(
    db: Database,
    chatId: string,
    fromIndex: number,
    toIndex: number
): Promise<EventsResponse | undefined> {
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
        return { events: cachedMsgs };
    }
}

export function setCachedData(
    db: Database,
    blobId: bigint
): (data: Uint8Array | undefined) => Promise<Uint8Array | undefined> {
    return async (data: Uint8Array | undefined) => {
        if (!data) return Promise.resolve(data);
        (await db).put("media_data", data, blobId.toString());
        return data;
    };
}

export function setCachedMessages(
    db: Database,
    chatId: string
): (resp: EventsResponse) => Promise<EventsResponse> {
    return async (resp: EventsResponse) => {
        if (resp === "chat_not_found") return Promise.resolve(resp);
        if (resp === "not_authorised") return Promise.resolve(resp);
        const tx = (await db).transaction("chat_messages", "readwrite");
        const store = tx.objectStore("chat_messages");
        resp.events.forEach(async (event) => {
            await store.put(event, createCacheKey(chatId, event.index));
        });
        await tx.done;
        return resp;
    };
}
