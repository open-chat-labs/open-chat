import type { PartialUserSummary, UserLookup } from "../domain/user/user";
import { immutableStore } from "./immutable";

const OPENCHAT_BOT_USER_ID = "zzyk3-openc-hatbo-tq7my-cai";
const OPENCHAT_BOT_USERNAME = "OpenChatBot";
const OPENCHAT_BOT_AVATAR_URL = "/oc-logo2.svg";

const { subscribe, update } = immutableStore<UserLookup>({
    OPENCHAT_BOT_USER_ID: {
        kind: "bot",
        userId: OPENCHAT_BOT_USER_ID,
        username: OPENCHAT_BOT_USERNAME,
        lastOnline: 0,
        updated: BigInt(0),
        blobUrl: OPENCHAT_BOT_AVATAR_URL,
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
