import type { UserSummary } from "openchat-shared";
import { derived } from "svelte/store";
import { writable } from "../../utils/stores";
import { localUpdates } from "../localUpdates";
import { SafeMapStore } from "../map";

export const serverBlockedUsersStore = writable<Set<string>>(new Set());

export const blockedUsersStore = derived(
    [serverBlockedUsersStore, localUpdates.blockedDirectUsers],
    ([serverBlockedUsers, localUpdates]) => localUpdates.apply(serverBlockedUsers),
);

export const normalUsersStore = new SafeMapStore<string, UserSummary>();
export const specialUsersStore = new SafeMapStore<string, UserSummary>();
export const allUsersStore = derived(
    [normalUsersStore, specialUsersStore],
    ([normalUsers, specialUsers]) => {
        return specialUsers.reduce((all, [k, v]) => {
            all.set(k, v);
            return all;
        }, normalUsers.clone()); // this clone is necessary to prevent infinite loop but will it be a problem?
    },
);
export const suspendedUsersStore = derived(allUsersStore, (allUsers) => {
    const suspended = new Map<string, UserSummary>();
    for (const [k, v] of allUsers) {
        if (v.suspended) {
            suspended.set(k, v);
        }
    }
    return suspended as ReadonlyMap<string, UserSummary>;
});
