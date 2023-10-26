import { type IDBPDatabase, type IDBPCursorWithValue } from "idb";
import type { ChatEvent, ExpiredEventsRange, IndexRange, MessageContext } from "openchat-shared";
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
): Promise<[EnhancedWrapper<ChatEvent>[], ExpiredEventsRange[], Set<number>]> {
    const bound = ascending ? eventIndexRange[1] : eventIndexRange[0];
    const iterator = await EventsIterator.create(db, context, startIndex, ascending, bound);

    const events: EnhancedWrapper<ChatEvent>[] = [];
    const expiredEventRanges: ExpiredEventsRange[] = [];
    const missing = new Set<number>();
    let messageCount = 0;
    let expectedNextIndex: number = startIndex;
    let previous: EnhancedWrapper<ChatEvent> | ExpiredEventsRange | undefined = undefined;

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
                if (missing.size > maxMissing) {
                    break;
                }
            }

            expectedNextIndex = endIndex + 1;
        } else {
            const [startIndex, endIndex] =
                next.kind === "event" ? [next.index, next.index] : [next.end, next.start];

            for (let i = expectedNextIndex; i > startIndex; i--) {
                missing.add(i);
                if (missing.size > maxMissing) {
                    break;
                }
            }

            expectedNextIndex = endIndex - 1;
        }

        if (next.kind === "event") {
            events.push(next);

            if (next.event.kind === "message") {
                if (++messageCount == maxMessages) {
                    break;
                }
            }
        } else {
            if (previous?.kind === "expired_events_range" && isContiguous(previous, next)) {
                expiredEventRanges[expiredEventRanges.length - 1] = mergeRanges(previous, next);
            } else {
                expiredEventRanges.push(next);
            }
        }
        previous = next;
    }

    return [events, expiredEventRanges, missing];
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
        return right.start >= left.end + 1;
    } else {
        return left.start <= right.end + 1;
    }
}

class EventsIterator {
    private hasStarted: boolean = false;
    private previous: EnhancedWrapper<ChatEvent> | ExpiredEventsRange | undefined = undefined;

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

    async getNext(): Promise<EnhancedWrapper<ChatEvent> | ExpiredEventsRange | undefined> {
        const isFirst = !this.hasStarted;
        if (isFirst) {
            this.hasStarted = true;
        } else {
            await this.advance();
        }

        const previous = this.previous;
        const value = (this.previous = this.cursor?.value);

        // If this value matches the previous value, skip it, and yield the next value instead
        if (
            value?.kind === "expired_events_range" &&
            previous?.kind === "expired_events_range" &&
            value.start === previous.start &&
            value.end === previous.end
        ) {
            return await this.getNext();
        }
        return value;
    }

    private async advance(): Promise<boolean> {
        try {
            await this.cursor?.advance(1);
            return true;
        } catch {
            this.cursor = undefined;
            this.previous = undefined;
            if (this.onComplete !== undefined) {
                await this.onComplete();
            }
            return false;
        }
    }
}
