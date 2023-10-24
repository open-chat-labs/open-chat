import { type IDBPDatabase, type IDBPCursorWithValue } from "idb";
import type { ChatEvent, EventWrapper, IndexRange, MessageContext } from "openchat-shared";
import type { ChatSchema, EnhancedWrapper } from "./caching";
import { createCacheKey } from "./caching";

export async function iterateCachedEvents(
    db: IDBPDatabase<ChatSchema>,
    eventIndexRange: IndexRange,
    context: MessageContext,
    startIndex: number,
    ascending: boolean,
    maxEvents: number,
    maxMessages: number,
    maxMissing: number,
): Promise<[EventWrapper<ChatEvent>[], Set<number>]> {
    const bound = ascending ? eventIndexRange[1] : eventIndexRange[0];
    const iterator = await EventsIterator.create(db, context, startIndex, ascending, bound);

    const events: EnhancedWrapper<ChatEvent>[] = [];
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

        events.push(next);

        if (ascending) {
            for (let i = expectedNextIndex; i < next.index; i++) {
                missing.add(i);
                if (missing.size > maxMissing) {
                    break;
                }
            }

            expectedNextIndex = next.index + 1;
            if (expectedNextIndex > bound) break;
        } else {
            for (let i = expectedNextIndex; i > next.index; i--) {
                missing.add(i);
                if (missing.size > maxMissing) {
                    break;
                }
            }

            expectedNextIndex = next.index - 1;
            if (expectedNextIndex < bound) break;
        }

        if (next.event.kind === "message") {
            if (++messageCount == maxMessages) {
                break;
            }
        }
    }

    return [events, missing];
}

class EventsIterator {
    private hasStarted: boolean = false;

    private constructor(
        private cursor?: IDBPCursorWithValue<
            ChatSchema,
            ("chat_events" | "thread_events")[],
            "chat_events" | "thread_events"
        > | null,
        private onComplete?: () => Promise<void>,
    ) {}

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

    async getNext(): Promise<EnhancedWrapper<ChatEvent> | undefined> {
        const isFirst = !this.hasStarted;
        if (isFirst) {
            this.hasStarted = true;
        } else {
            await this.advance();
        }
        return this.cursor?.value;
    }

    private async advance(): Promise<boolean> {
        try {
            await this.cursor?.advance(1);
            return true;
        } catch {
            this.cursor = null;
            if (this.onComplete !== undefined) {
                await this.onComplete();
            }
            return false;
        }
    }
}
