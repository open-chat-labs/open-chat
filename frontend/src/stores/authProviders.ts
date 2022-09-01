import { AuthProvider } from "../domain/auth";
import { derived, readable, writable } from "svelte/store";
import { configKeys } from "../utils/config";
import { userCreatedStore } from "./settings";
import { enumFromStringValue } from "../utils/enums";

export const selectedAuthProviderStore = createStore();

function createStore() {
    const key = configKeys.selectedAuthProvider;
    const def = AuthProvider.II;
    const stored = localStorage.getItem(key);
    const initial = stored !== null ? enumFromStringValue(AuthProvider, stored, def) : def;

    const store = writable<AuthProvider>(initial);
    return {
        subscribe: store.subscribe,
        set: (authProvider: AuthProvider): void =>
            store.update((_) => {
                localStorage.setItem(key, authProvider);
                return authProvider;
            }),
    };
}

const hasIISessionStore = readable<boolean>(localStorage.getItem("ic-delegation") !== null);

export const showAuthProvidersStore = derived(
    [userCreatedStore, hasIISessionStore],
    ([userCreated, hasIISession]) => {
        return !userCreated && !hasIISession;
    }
);
