import { writable, get } from "svelte/store";
import type { PartialUserSummary, UserLookup } from "../domain/user/user";

const userLookup = writable<UserLookup>({});

export const userStore = {
    subscribe: userLookup.subscribe,
    add: (user: PartialUserSummary): void => {
        userLookup.update((users) => {
            users[user.userId] = user;
            return users;
        });
    },
    addMany: (addUsers: PartialUserSummary[]): void => {
        userLookup.update((users) => {
            addUsers.forEach((user) => {
                users[user.userId] = user;
            });
            return users;
        });
    },
};
