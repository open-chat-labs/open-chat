import { openDB, DBSchema, IDBPDatabase } from "idb";
import type { Message, MessagesResponse } from "../domain/chat/chat";
import { rollbar } from "./logging";

type Database = Promise<IDBPDatabase<ChatSchema>>;

export interface ChatSchema extends DBSchema {
    chat_messages: {
        key: string;
        value: Message;
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
        return openDB<ChatSchema>("openchat_db", 1, {
            upgrade(db) {
                db.createObjectStore("chat_messages");
            },
        });
    } catch (err) {
        rollbar.error("Unable to open indexDB", err);
    }
}

export async function getCachedMessages(
    db: Database,
    chatId: string,
    fromIndex: number,
    toIndex: number
): Promise<MessagesResponse | undefined> {
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
        return { messages: cachedMsgs };
    }
}

export function setCachedMessages(
    db: Database,
    chatId: string
): (resp: MessagesResponse) => Promise<MessagesResponse> {
    return async (resp: MessagesResponse) => {
        if (resp === "chat_not_found") return Promise.resolve(resp);
        const tx = (await db).transaction("chat_messages", "readwrite");
        const store = tx.objectStore("chat_messages");
        resp.messages.forEach(async (msg) => {
            await store.put(msg, createCacheKey(chatId, msg.messageIndex));
        });
        await tx.done;
        return resp;
    };
}
