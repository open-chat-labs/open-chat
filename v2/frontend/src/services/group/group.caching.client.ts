import type { MessagesResponse, Message } from "../../domain/chat/chat";
import type { IGroupClient } from "./group.client.interface";
import { openDB, DBSchema, IDBPDatabase } from "idb";

interface ChatSchema extends DBSchema {
    chat_messages: {
        key: string;
        value: Message;
    };
}

function padMessageIndex(i: number): string {
    return i.toString().padStart(10, "0");
}

function createKey(chatId: string, index: number): string {
    return `${chatId}_${padMessageIndex(index)}`;
}

/**
 * This exists to decorate the user client so that we can provide a write through cache to
 * indexDB for holding chat messages
 */
export class CachingGroupClient implements IGroupClient {
    private db: Promise<IDBPDatabase<ChatSchema>>;

    constructor(private chatId: string, private client: IGroupClient) {
        this.db = openDB<ChatSchema>("openchat_db", 1, {
            upgrade(db) {
                db.createObjectStore("chat_messages");
            },
        });
    }

    private async getCachedMessages(
        chatId: string,
        fromIndex: number,
        toIndex: number
    ): Promise<Message[]> {
        const db = await this.db;

        const cachedMsgs = await db.getAll(
            "chat_messages",
            IDBKeyRange.bound(createKey(chatId, fromIndex), createKey(chatId, toIndex))
        );

        return cachedMsgs;
    }

    async chatMessages(fromIndex: number, toIndex: number): Promise<MessagesResponse> {
        const cachedMsgs = await this.getCachedMessages(this.chatId, fromIndex, toIndex);
        console.log("cache", cachedMsgs.length, toIndex - fromIndex);
        if (cachedMsgs.length === toIndex - fromIndex + 1) {
            // the range is inclusive
            console.log("cache hit!", cachedMsgs);
            return { messages: cachedMsgs };
        }

        console.log("cache miss");

        const resp = await this.client.chatMessages(fromIndex, toIndex);
        if (resp !== "chat_not_found") {
            const db = await this.db;
            const tx = db.transaction("chat_messages", "readwrite");
            const store = tx.objectStore("chat_messages");
            const msgs = resp.messages;
            msgs.forEach(async (msg) => {
                await store.put(msg, createKey(this.chatId, msg.messageIndex));
            });
            await tx.done;
        }
        return resp;
    }
}
