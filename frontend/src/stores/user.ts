import type { PartialUserSummary, UserLookup } from "../domain/user/user";
import { immutableStore } from "./immutable";

export const OPENCHAT_BOT_USER_ID = "zzyk3-openc-hatbo-tq7my-cai";
export const OPENCHAT_BOT_USERNAME = "OpenChatBot";
export const OPENCHAT_BOT_AVATAR_URL = "assets/robot.svg";
const botUser: PartialUserSummary = {
    kind: "bot",
    userId: OPENCHAT_BOT_USER_ID,
    username: OPENCHAT_BOT_USERNAME,
    lastOnline: 0,
    updated: BigInt(0),
    blobUrl: OPENCHAT_BOT_AVATAR_URL,
};

const { subscribe, update, set } = immutableStore<UserLookup>({
    [OPENCHAT_BOT_USER_ID]: botUser,
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
    set: (users: UserLookup): void => {
        users[OPENCHAT_BOT_USER_ID] = botUser;
        set(users);
    },
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
