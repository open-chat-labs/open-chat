/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { writable, type Writable } from "svelte/store";
import { type MessageContext, MessageContextMap } from "openchat-shared";

function setDataForMessageContext<T>(
    store: Writable<MessageContextMap<T>>,
    context: MessageContext,
    data: T,
): void {
    store.update((s) => {
        s.set(context, data);
        return s;
    });
}

function updateDataForMessageContext<T>(
    store: Writable<MessageContextMap<T>>,
    context: MessageContext,
    fn: (updateFn: T) => T,
    empty: T,
): void {
    store.update((s) => {
        s.set(context, fn(s.get(context) ?? empty));
        return s;
    });
}

export function createMessageContextSpecificObjectStore<T>(init: () => T) {
    const store = writable(new MessageContextMap<T>());
    let storeValue = new MessageContextMap<T>();
    store.subscribe((v) => (storeValue = v));

    return {
        subscribe: store.subscribe,
        get: (context: MessageContext): T => storeValue.get(context) ?? init(),
        update: (context: MessageContext, fn: (data: T) => T) =>
            updateDataForMessageContext(store, context, fn, init()),
        set: (context: MessageContext, data: T) => setDataForMessageContext(store, context, data),
        has: (context: MessageContext) => storeValue.has(context),
        delete: (context: MessageContext) => {
            if (storeValue.has(context)) {
                store.update((state) => {
                    state.delete(context);
                    return state;
                });
                return true;
            }
            return false;
        },
        clear: (newValue?: MessageContextMap<T>): void =>
            store.set(newValue ?? new MessageContextMap<T>()),
        size: (): number => storeValue.size,
    };
}
