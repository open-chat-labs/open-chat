import type { PartialUserSummary, UserLookup } from "../domain/user/user";
import { immutableStore } from "./immutable";

const { subscribe, update } = immutableStore<UserLookup>({
    "zzyk3-openc-hatbo-tq7my-cai": {
        kind: "bot",
        userId: "zzyk3-openc-hatbo-tq7my-cai",
        username: "OpenChatBot",
        lastOnline: 0,
        updated: BigInt(0),
        blobUrl: "/oc-logo2.svg",
    },
});

export function overwriteUser(lookup: UserLookup, user: PartialUserSummary): UserLookup {
    return {
        ...lookup,
        [user.userId]: {
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
    setUpdated: (userIds: string[], timestamp: bigint): void => {
        update((users) => {
            for (const userId of userIds) {
                const user = users[userId];
                if (user !== undefined) {
                    user.updated = timestamp;
                }
            }
            return users;
        });
    },
};
