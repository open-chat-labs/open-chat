import type { UserSummary } from "openchat-shared";
import { derived, writable } from "../../utils/stores";
import { localUpdates } from "../localUpdates";
import { notEq } from "../utils";

export const serverBlockedUsersStore = writable<Set<string>>(new Set());

export const blockedUsersStore = derived(
    [serverBlockedUsersStore, localUpdates.blockedDirectUsers],
    ([serverBlockedUsers, localUpdates]) => localUpdates.apply(serverBlockedUsers),
);

export const normalUsersStore = writable<Map<string, UserSummary>>(new Map(), undefined, notEq);
export const specialUsersStore = writable<Map<string, UserSummary>>(new Map(), undefined, notEq);
export const allUsersStore = derived(
    [normalUsersStore, specialUsersStore],
    ([normalUsers, specialUsers]) => {
        return [...specialUsers.entries()].reduce((all, [k, v]) => {
            all.set(k, v);
            return all;
        }, new Map(normalUsers)); // this clone is necessary to prevent infinite loop but will it be a problem?
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
export const webhookUserIdsStore = writable(new Set<string>());
