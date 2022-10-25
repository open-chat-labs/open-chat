import { Poller } from "../utils/poller";
import type { OpenChatAgent, PartialUserSummary, UserLookup } from "openchat-agent";
import { derived, get, writable } from "svelte/store";
import { chunk, groupBy } from "../utils/list";
import { chatSummariesStore, currentUserStore } from "./chat";

const ONE_MINUTE = 60 * 1000;
const ONE_HOUR = 60 * ONE_MINUTE;
const USER_UPDATE_INTERVAL = ONE_MINUTE;
const MAX_USERS_TO_UPDATE_PER_BATCH = 100;

export const currentUserKey = Symbol();
export const OPENCHAT_BOT_USER_ID = "zzyk3-openc-hatbo-tq7my-cai";
export const OPENCHAT_BOT_USERNAME = "OpenChatBot";
export const OPENCHAT_BOT_AVATAR_URL = "assets/robot.svg";
export const openChatBotUser: PartialUserSummary = {
    kind: "bot",
    userId: OPENCHAT_BOT_USER_ID,
    username: OPENCHAT_BOT_USERNAME,
    lastOnline: 0,
    updated: BigInt(0),
    blobUrl: OPENCHAT_BOT_AVATAR_URL,
};

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
export const PROPOSALS_BOT_USER_ID = process.env.PROPOSALS_BOT_CANISTER!;
export const PROPOSALS_BOT_USERNAME = "ProposalsBot";
export const PROPOSALS_BOT_AVATAR_URL = "assets/proposal-robot.svg";

export function proposalsBotUser(userId: string): PartialUserSummary {
    return {
        kind: "bot",
        userId,
        username: PROPOSALS_BOT_USERNAME,
        lastOnline: 0,
        updated: BigInt(0),
        blobUrl: PROPOSALS_BOT_AVATAR_URL,
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

async function updateUsers(api: OpenChatAgent) {
    try {
        const currentUser = get(currentUserStore);
        if (currentUser === undefined) {
            console.log("Current user not set, cannot update users");
            return;
        }

        const allUsers = get(userStore);
        const usersToUpdate = new Set<string>([currentUser.userId]);

        // Update all users we have direct chats with
        for (const chat of Object.values(get(chatSummariesStore))) {
            if (chat.kind == "direct_chat") {
                usersToUpdate.add(chat.them);
            }
        }

        // Also update any users who haven't been updated for at least an hour
        const now = BigInt(Date.now());
        for (const user of Object.values(allUsers)) {
            if (now - user.updated > ONE_HOUR && user.kind === "user") {
                usersToUpdate.add(user.userId);
            }
        }

        console.log(`getting updates for ${usersToUpdate.size} user(s)`);
        for (const batch of chunk(Array.from(usersToUpdate), MAX_USERS_TO_UPDATE_PER_BATCH)) {
            const userGroups = groupBy<string, bigint>(batch, (u) => {
                return allUsers[u]?.updated ?? BigInt(0);
            });

            const usersResp = await api.getUsers({
                userGroups: Array.from(userGroups).map(([updatedSince, users]) => ({
                    users,
                    updatedSince,
                })),
            });
            userStore.addMany(usersResp.users);
            if (usersResp.serverTimestamp !== undefined) {
                userStore.setUpdated(batch, usersResp.serverTimestamp);
            }
        }
    } catch (err) {
        api.logError("Error updating users", err as Error);
    }
}

export function startUserUpdatePoller(api: OpenChatAgent): Poller {
    return new Poller(() => updateUsers(api), USER_UPDATE_INTERVAL, USER_UPDATE_INTERVAL);
}
