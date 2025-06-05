import type { UserSummary } from "openchat-shared";
import { derived, writable } from "../../utils/stores";
import { localUpdates } from "../localUpdates";
import { notEq } from "../utils";
import { UnionMaps } from "../../utils/unionMaps";

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
        return new UnionMaps(normalUsers, specialUsers);
    },
);
export const suspendedUsersStore = writable(new Set<string>(), undefined, notEq);
export const webhookUserIdsStore = writable(new Set<string>(), undefined, notEq);
