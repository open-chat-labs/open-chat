import { openDB, DBSchema, IDBPDatabase } from "idb";
import type {
    EventsResponse,
    EventWrapper,
    MediaContent,
    MessageContent,
} from "../domain/chat/chat";
import { rollbar } from "./logging";

type Database = Promise<IDBPDatabase<ChatSchema>>;

type CacheableMessageContent<T extends MessageContent> = T extends MediaContent
    ? Omit<MediaContent, "blobData">
    : T;

type MakeCacheable<T> = {
    [Prop in keyof T]: T[Prop] extends MessageContent
        ? CacheableMessageContent<T[Prop]>
        : MakeCacheable<T[Prop]>;
};

export interface ChatSchema extends DBSchema {
    chat_messages: {
        key: string;
        value: MakeCacheable<EventWrapper>;
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
        return openDB<ChatSchema>("openchat_db", 5, {
            upgrade(db, _oldVersion, _newVersion) {
                try {
                    if (db.objectStoreNames.contains("chat_messages")) {
                        db.deleteObjectStore("chat_messages");
                    }
                    if (db.objectStoreNames.contains("media_data")) {
                        db.deleteObjectStore("media_data");
                    }
                    db.createObjectStore("chat_messages");
                    db.createObjectStore("media_data");
                } catch (err) {
                    rollbar.error("Unable to upgrade indexDB", err);
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

        // we tell typescript a little white lie here because blobData will be undefined on any MediaContent
        // records
        return { events: cachedMsgs as EventWrapper[] };
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

// we need to strip out the blobData promise from any media content because that cannot be serialised
function makeSerialisable(ev: EventWrapper): MakeCacheable<EventWrapper> {
    if (ev.event.kind === "message" && ev.event.content.kind === "media_content") {
        return {
            ...ev,
            event: {
                ...ev.event,
                content: {
                    kind: "media_content",
                    caption: ev.event.content.caption,
                    height: ev.event.content.height,
                    width: ev.event.content.width,
                    mimeType: ev.event.content.mimeType,
                    blobReference: ev.event.content.blobReference,
                    thumbnailData: ev.event.content.thumbnailData,
                },
            },
        };
    }
    return ev;
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
            await store.put(makeSerialisable(event), createCacheKey(chatId, event.index));
        });
        await tx.done;
        return resp;
    };
}
