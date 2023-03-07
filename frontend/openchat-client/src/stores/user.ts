import type { PartialUserSummary, UserLookup } from "openchat-shared";
import { derived, writable } from "svelte/store";

export const currentUserKey = Symbol();
export const OPENCHAT_BOT_USER_ID = "zzyk3-openc-hatbo-tq7my-cai";
export const OPENCHAT_BOT_USERNAME = "OpenChatBot";
export const OPENCHAT_BOT_AVATAR_URL = "assets/robot.svg";
export const openChatBotUser: PartialUserSummary = {
    kind: "bot",
    userId: OPENCHAT_BOT_USER_ID,
    username: OPENCHAT_BOT_USERNAME,
    updated: BigInt(0),
    suspended: false,
    blobUrl: OPENCHAT_BOT_AVATAR_URL,
    diamond: false,
};

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
export const PROPOSALS_BOT_USERNAME = "ProposalsBot";
export const PROPOSALS_BOT_AVATAR_URL = "assets/proposal-robot.svg";

export function proposalsBotUser(userId: string): PartialUserSummary {
    return {
        kind: "bot",
        userId,
        username: PROPOSALS_BOT_USERNAME,
        updated: BigInt(0),
        suspended: false,
        blobUrl: PROPOSALS_BOT_AVATAR_URL,
        diamond: false,
    };
}

export const specialUsers = writable<UserLookup>({});
const normalUsers = writable<UserLookup>({});

const allUsers = derived([specialUsers, normalUsers], ([$specialUsers, $normalUsers]) => {
    return Object.entries($specialUsers).reduce((all, [k, v]) => {
        all[k] = v;
        return all;
    }, $normalUsers);
});

export function overwriteUser(lookup: UserLookup, user: PartialUserSummary): UserLookup {
    lookup[user.userId] = {
        ...user,
        username: user.username ?? lookup[user.userId]?.username,
    };
    return lookup;
}

export const userStore = {
    subscribe: allUsers.subscribe,
    set: (users: UserLookup): void => normalUsers.set(users),
    add: (user: PartialUserSummary): void => {
        normalUsers.update((users) => {
            const clone = { ...users };
            return overwriteUser(clone, user);
        });
    },
    addMany: (newUsers: PartialUserSummary[]): void => {
        normalUsers.update((users) => {
            const clone = { ...users };
            return newUsers.reduce((lookup, user) => overwriteUser(lookup, user), clone);
        });
    },
    setUpdated: (userIds: string[], timestamp: bigint): void => {
        normalUsers.update((users) => {
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
