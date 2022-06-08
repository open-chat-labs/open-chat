import { writable } from "svelte/store";
import type { EventWrapper, Message, ThreadSummary } from "../domain/chat/chat";

/**
 * This just holds some dummy state for us while we don't have an api
 */

// messageIndex -> events
type ThreadLookup = Record<number, EventWrapper<Message>[]>;

// messageIndex -> ThreadSummary for fake threads
type ThreadSummaryLookup = Record<number, ThreadSummary>;

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
});

const { subscribe, set } = writable<ThreadLookup>({});

export const threadStore = {
    subscribe,
    set,
};
