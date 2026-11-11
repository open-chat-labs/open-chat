import { MessageContextMap, type UnconfirmedState } from "@shared";
import type { Subscriber } from "svelte/store";
import { notEq } from "../state/utils";
import type { UnconfirmedReadReceipt } from "../utils/chat";
import { writable } from "../utils/stores";

export type UnconfirmedMessages = MessageContextMap<UnconfirmedState>;

/**
 * The read receipts from the other person in a DM that came in over WebRTC and that the DM's
 * `readByThemUpTo` doesn't confirm yet, by message id. The client adds them as they come in and
 * drops them as the chats' updates confirm them.
 */
function createUnconfirmedReadByThemStore() {
    const store = writable(new Map<bigint, UnconfirmedReadReceipt>(), undefined, notEq);
    let storeValue = new Map<bigint, UnconfirmedReadReceipt>();
    store.subscribe((value) => (storeValue = value));

    return {
        subscribe: (
            subscriber: Subscriber<ReadonlyMap<bigint, UnconfirmedReadReceipt>>,
            invalidate?: () => void,
        ) => store.subscribe(subscriber, invalidate),
        get value(): ReadonlyMap<bigint, UnconfirmedReadReceipt> {
            return storeValue;
        },
        add: (messageId: bigint, receipt: UnconfirmedReadReceipt): void => {
            store.set(new Map(storeValue).set(messageId, receipt));
        },
        deleteMany: (messageIds: readonly bigint[]): void => {
            const toDelete = messageIds.filter((id) => storeValue.has(id));
            if (toDelete.length === 0) return;
            const next = new Map(storeValue);
            for (const id of toDelete) {
                next.delete(id);
            }
            store.set(next);
        },
        clear: (): void => {
            if (storeValue.size > 0) store.set(new Map());
        },
    };
}

export const unconfirmedReadByThem = createUnconfirmedReadByThemStore();
