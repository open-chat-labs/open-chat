import { writable } from "svelte/store";
import type { ChatEvent, EventWrapper, Message } from "../domain/chat/chat";

/**
 * This is just a dummy store to simulate the state tracking for a threaded message
 */

type ThreadLookup = Record<number, Record<number, EventWrapper<Message>>>;

const { subscribe, update, set } = writable<ThreadLookup>({});

export const threadStore = {
    subscribe,
    update,
    set,
    addToThread: (event: EventWrapper<Message>): void => {
        update((lookup) => {
            const id = Number(event.event.messageId);
            if (lookup[id] === undefined) {
                lookup[id] = {};
            }
            lookup[id][id] = event;
            return lookup;
        });
    },
};

export function hasThread(lookup: ThreadLookup, event: EventWrapper<ChatEvent>): boolean {
    if (event.event.kind !== "message") return false;
    const id = Number(event.event.messageId);
    return lookup[id] !== undefined;
}
