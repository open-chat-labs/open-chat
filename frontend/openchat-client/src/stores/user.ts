import {
    type UserSummary,
    type UserLookup,
    ANON_USER_ID,
    ANON_USERNAME,
    ANON_DISPLAY_NAME,
    ANON_AVATAR_URL,
    type CreatedUser,
    anonymousUser,
} from "openchat-shared";
import { derived, writable } from "svelte/store";
import { createSetStore } from "./setStore";

export const currentUserKey = Symbol();
export const OPENCHAT_BOT_USER_ID = "zzyk3-openc-hatbo-tq7my-cai";
export const OPENCHAT_BOT_USERNAME = "OpenChatBot";
export const OPENCHAT_BOT_AVATAR_URL = "/assets/robot.svg";
export const openChatBotUser: UserSummary = {
    kind: "bot",
    userId: OPENCHAT_BOT_USER_ID,
    username: OPENCHAT_BOT_USERNAME,
    displayName: undefined,
    updated: BigInt(0),
    suspended: false,
    blobUrl: OPENCHAT_BOT_AVATAR_URL,
    diamondStatus: "inactive",
};

export const anonymousUserSummary: UserSummary = {
    kind: "user",
    userId: ANON_USER_ID,
    username: ANON_USERNAME,
    displayName: ANON_DISPLAY_NAME,
    updated: BigInt(0),
    suspended: false,
    blobUrl: ANON_AVATAR_URL,
    diamondStatus: "inactive",
};

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
export const PROPOSALS_BOT_USERNAME = "ProposalsBot";
export const PROPOSALS_BOT_AVATAR_URL = "/assets/proposal-robot.svg";

export function proposalsBotUser(userId: string): UserSummary {
    return {
        kind: "bot",
        userId,
        username: PROPOSALS_BOT_USERNAME,
        displayName: undefined,
        updated: BigInt(0),
        suspended: false,
        blobUrl: PROPOSALS_BOT_AVATAR_URL,
        diamondStatus: "inactive",
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

export const suspendedUsers = createSetStore(writable(new Set<string>()));

export function overwriteUser(lookup: UserLookup, user: UserSummary): UserLookup {
    lookup[user.userId] = { ...user };
    return lookup;
}

export const userStore = {
    subscribe: allUsers.subscribe,
    set: (users: UserLookup): void => {
        normalUsers.set(users);
        const [suspended, _] = partitionSuspendedUsers(Object.values(users));
        suspendedUsers.set(new Set(suspended));
    },
    add: (user: UserSummary): void => {
        normalUsers.update((users) => {
            const clone = { ...users };
            return overwriteUser(clone, user);
        });
        if (user.suspended) {
            suspendedUsers.add(user.userId);
        } else {
            suspendedUsers.delete(user.userId);
        }
    },
    addMany: (newUsers: UserSummary[]): void => {
        normalUsers.update((users) => {
            const clone = { ...users };
            return newUsers.reduce((lookup, user) => overwriteUser(lookup, user), clone);
        });
        const [suspended, notSuspended] = partitionSuspendedUsers(newUsers);
        suspendedUsers.addMany(suspended);
        suspendedUsers.deleteMany(notSuspended);
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

export const currentUser = writable<CreatedUser>(anonymousUser());

export const currentUserIdStore = derived(currentUser, ($currentUser) => $currentUser.userId);

export const anonUser = derived(
    currentUser,
    ($currentUser) => $currentUser.userId === ANON_USER_ID,
);
export const suspendedUser = derived(
    currentUser,
    ($currentUser) => $currentUser.suspensionDetails !== undefined,
);
export const platformModerator = derived(
    currentUser,
    ($currentUser) => $currentUser.isPlatformModerator,
);

export const platformOperator = derived(currentUser, ($currentUser) => {
    return $currentUser.isPlatformOperator;
});

function partitionSuspendedUsers(users: UserSummary[]): [string[], string[]] {
    const suspended = [];
    const notSuspended = [];
    for (const user of users) {
        if (user.suspended) {
            suspended.push(user.userId);
        } else {
            notSuspended.push(user.userId);
        }
    }
    return [suspended, notSuspended];
}
