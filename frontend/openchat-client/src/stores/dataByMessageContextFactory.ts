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

export function createMessageContextSpecificObjectStore<T>(
    initValue: () => T,
    initStore?: MessageContextMap<T>,
) {
    const store = writable(initStore ?? new MessageContextMap<T>());
    let storeValue = new MessageContextMap<T>();
    store.subscribe((v) => (storeValue = v));

    return {
        subscribe: store.subscribe,
        get: (context: MessageContext): T => storeValue.get(context) ?? initValue(),
        update: (context: MessageContext, fn: (data: T) => T) =>
            updateDataForMessageContext(store, context, fn, initValue()),
        set: (context: MessageContext, data: T) => setDataForMessageContext(store, context, data),
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
        clear: (): void => store.set(new MessageContextMap<T>()),
    };
}
