import { writable } from "svelte/store";
import type { PartialUserSummary, UserLookup } from "../domain/user/user";

const { subscribe, update } = writable<UserLookup>({});

export const userStore = {
    subscribe,
    add: (user: PartialUserSummary): void => {
        update((users) => {
            return {
                ...users,
                [user.userId]: user,
            };
        });
    },
    addMany: (newUsers: PartialUserSummary[]): void => {
        update((users) => {
            return newUsers.reduce((lookup, user) => {
                return {
                    ...lookup,
                    [user.userId]: user,
                };
            }, users);
        });
    },
};
