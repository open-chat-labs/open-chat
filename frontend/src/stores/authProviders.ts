import { AuthProvider } from "../domain/auth";
import { writable } from "svelte/store";
import { configKeys } from "../utils/config";
import { enumFromStringValue } from "../utils/enums";
import { IdbStorage, LocalStorage } from "@dfinity/auth-client";

export const selectedAuthProviderStore = createStore();

function createStore() {
    const key = configKeys.selectedAuthProvider;
    const def = AuthProvider.NFID;
    const stored = localStorage.getItem(key);
    const initial = stored !== null ? enumFromStringValue(AuthProvider, stored, def) : def;

    const store = writable<AuthProvider>(initial);

    function _init(authProvider: AuthProvider) {
        if (localStorage.getItem(key) === null) {
            _set(authProvider);
        }
    }

    function _set(authProvider: AuthProvider) {
        store.update((_) => {
            localStorage.setItem(key, authProvider);
            return authProvider;
        });
    }

    return {
        subscribe: store.subscribe,
        init: (authProvider: AuthProvider): void => _init(authProvider),
        set: (authProvider: AuthProvider): void => _set(authProvider),
    };
}

export const idbAuthClientStore = new IdbStorage();
export const lsAuthClientStore = new LocalStorage();
