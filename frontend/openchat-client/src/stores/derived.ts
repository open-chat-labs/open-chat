import { Readable, derived, get } from "svelte/store";

export function createDerivedPropStore<S, P extends keyof S>(
    store: Readable<S | undefined>,
    prop: P,
    empty: () => S[P],
    eq: (current: S[P], next: S[P]) => boolean = (current: S[P], next: S[P]) => current === next
): Readable<S[P]> {
    const storeVal = get(store);
    let initialised = false;
    let currentValue: S[P] = storeVal ? storeVal[prop] : empty();
    return derived(store, ($store, set) => {
        const nextValue: S[P] = $store ? $store[prop] : empty();
        if (!eq(currentValue, nextValue) || !initialised) {
            set(nextValue);
        }
        currentValue = nextValue;
        initialised = true;
    });
}
