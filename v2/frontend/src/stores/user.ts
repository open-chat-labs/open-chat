import { writable } from "svelte/store";
import type { PartialUserSummary, UserLookup } from "../domain/user/user";

const { subscribe, update } = writable<UserLookup>({});

export function overwriteUser(lookup: UserLookup, user: PartialUserSummary): UserLookup {
    return {
        ...lookup,
        [user.userId]: {
            ...lookup[user.userId],
            ...user,
            username: user.username ?? lookup[user.userId]?.username,
        },
    };
}

export const userStore = {
    subscribe,
    add: (user: PartialUserSummary): void => {
        update((users) => overwriteUser(users, user));
    },
    addMany: (newUsers: PartialUserSummary[]): void => {
        update((users) => {
            return newUsers.reduce((lookup, user) => overwriteUser(lookup, user), users);
        });
    },
};
