import { writable } from "svelte/store";
import type { EventWrapper, Message, ThreadSummary } from "../domain/chat/chat";

/**
 * This just holds some dummy state for us while we don't have an api
 */

// messageIndex -> events
type ThreadLookup = Record<number, EventWrapper<Message>[]>;

// messageIndex -> ThreadSummary for fake threads
type ThreadSummaryLookup = Record<number, ThreadSummary>;

// todo this needs to be per chat! but let's work out whether this is going to be permanent first
export const threadSummaryStore = writable<ThreadSummaryLookup>({
    54: {
        participantIds: new Set([
            "sbzkb-zqaaa-aaaaa-aaaiq-cai",
            "sgymv-uiaaa-aaaaa-aaaia-cai",
            "si2b5-pyaaa-aaaaa-aaaja-cai",
            "sp3hj-caaaa-aaaaa-aaajq-cai",
            "s24we-diaaa-aaaaa-aaaka-cai",
            "st75y-vaaaa-aaaaa-aaalq-cai",
        ]),
        numberOfReplies: 6,
        latestEventIndex: 12345,
        latestEventTimestamp: BigInt(1654682280233),
    },
    55: {
        participantIds: new Set([
            "sbzkb-zqaaa-aaaaa-aaaiq-cai",
            "sgymv-uiaaa-aaaaa-aaaia-cai",
            "si2b5-pyaaa-aaaaa-aaaja-cai",
        ]),
        numberOfReplies: 10,
        latestEventIndex: 12345,
        latestEventTimestamp: BigInt(1654682280233),
    },
});

const { subscribe, set, update } = writable<ThreadLookup>({});

export const threadStore = {
    subscribe,
    set,
    addMessageToThread: (messageIndex: number, evt: EventWrapper<Message>): void => {
        update((store) => {
            if (store[messageIndex] === undefined) {
                store[messageIndex] = [];
            }
            store[messageIndex].push(evt);
            return store;
        });
    },
    replaceMessageInThread: (messageIndex: number, evt: EventWrapper<Message>): void => {
        update((store) => {
            if (store[messageIndex] === undefined) {
                return store;
            }
            store[messageIndex] = store[messageIndex].map((ev) =>
                ev.index === evt.index ? evt : ev
            );
            return store;
        });
    },
};

export function getNextEventIndex(lookup: ThreadLookup, messageIndex: number): number {
    const evts = lookup[messageIndex] ?? [];
    return (evts[evts.length - 1]?.index ?? 0) + 1;
}
