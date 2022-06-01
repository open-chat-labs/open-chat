import type { EventWrapper, Message } from "../domain/chat/chat";
import { immutableStore } from "./immutable";

type ThreadLookup = Record<number, EventWrapper<Message>[]>;

const { subscribe, update, set } = immutableStore<ThreadLookup>({});

export const threadStore = {
    subscribe,
    update,
    set,
};

export function hasThread(lookup: ThreadLookup, messageId: bigint): boolean {
    return lookup[Number(messageId)]?.length > 0;
}
