import type { UserSummary } from "openchat-shared";
import { derived, writable } from "../../utils/stores";
import { localUpdates } from "../localUpdates";
import { notEq } from "../utils";

export const serverBlockedUsersStore = writable<Set<string>>(new Set());

export const blockedUsersStore = derived(
    [serverBlockedUsersStore, localUpdates.blockedDirectUsers],
    ([serverBlockedUsers, localUpdates]) => localUpdates.apply(serverBlockedUsers),
);

export const allUsersStore = writable(new Map<string, UserSummary>(), undefined, notEq);
export const suspendedUsersStore = writable(new Set<string>(), undefined, notEq);
export const webhookUserIdsStore = writable(new Set<string>(), undefined, notEq);
