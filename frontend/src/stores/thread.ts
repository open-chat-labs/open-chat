import { writable } from "svelte/store";
import { dedupe } from "../utils/list";
import type { EventWrapper, Message, ThreadSummary } from "../domain/chat/chat";

/**
 * This just holds some dummy state for us while we don't have an api
 */

// messageIndex -> events
type ThreadLookup = Record<number, EventWrapper<Message>[]>;

// messageIndex -> ThreadSummary for fake threads
export type ThreadSummaryLookup = Record<number, ThreadSummary>;

// todo this needs to be per chat! but let's work out whether this is going to be permanent first
const internalThreadSummaryStore = writable<ThreadSummaryLookup>({
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

export const threadSummaryStore = {
    subscribe: internalThreadSummaryStore.subscribe,
    addMessageToThread: (rootEvt: EventWrapper<Message>, evt: EventWrapper<Message>): void => {
        internalThreadSummaryStore.update((lookup) => {
            const summary = lookup[rootEvt.event.messageIndex];
            return summary
                ? {
                      ...lookup,
                      [rootEvt.event.messageIndex]: {
                          ...summary,
                          participantIds: summary.participantIds.add(evt.event.sender),
                          numberOfReplies: summary.numberOfReplies + 1,
                          latestEventIndex: evt.index,
                          latestEventTimestamp: evt.timestamp,
                      },
                  }
                : lookup;
        });
    },
    createThread: (ev: EventWrapper<Message>): void => {
        internalThreadSummaryStore.update((lookup) => {
            const summary = lookup[ev.event.messageIndex] ?? {
                participantIds: new Set<string>([ev.event.sender]),
                numberOfReplies: 0,
                latestEventIndex: -1,
                latestEventTimestamp: BigInt(0),
            };
            return {
                ...lookup,
                [ev.event.messageIndex]: summary,
            };
        });
    },
};

const { subscribe, set, update } = writable<ThreadLookup>({});

export const threadStore = {
    subscribe,
    set,
    addMessageToThread: (
        messageIndex: number,
        rootEvt: EventWrapper<Message>,
        evt: EventWrapper<Message>
    ): void => {
        update((store) => {
            let evts = store[messageIndex] ?? [];
            evts.push(evt);
            evts = dedupe(
                (a, b) => a.index === b.index,
                evts.sort((a, b) => a.index - b.index)
            );
            if (evt !== rootEvt) {
                // we are adding a new message to the root of the thread so we should create a thread summary
                threadSummaryStore.createThread(rootEvt);
                threadSummaryStore.addMessageToThread(rootEvt, evt);
            }
            return {
                ...store,
                [messageIndex]: evts,
            };
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
