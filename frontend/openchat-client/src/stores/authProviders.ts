import { AuthProvider } from "openchat-shared";
import { writable } from "svelte/store";
import { configKeys } from "../utils/config";
import { enumFromStringValue } from "../utils/enums";

export const selectedAuthProviderStore = createStore();

function createStore() {
    const key = configKeys.selectedAuthProvider;
    const def = "PublicKeyCredential" in window ? undefined : AuthProvider.NFID;
    const stored = localStorage.getItem(key);
    const initial = stored !== null ? enumFromStringValue(AuthProvider, stored, def) : def;

    const store = writable<AuthProvider | undefined>(initial);

    function _set(authProvider: AuthProvider) {
        store.update((_) => {
            localStorage.setItem(key, authProvider);
            return authProvider;
        });
    }

    return {
        subscribe: store.subscribe,
        set: (authProvider: AuthProvider): void => _set(authProvider),
    };
}
