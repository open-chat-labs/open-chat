import { Poller } from "../fsm/poller";
import type { ServiceContainer } from "../services/serviceContainer";
import { get } from "svelte/store";
import { chunk, groupBy } from "../utils/list";
import { rollbar } from "../utils/logging";
import type { PartialUserSummary, UserLookup } from "../domain/user/user";
import { chatSummariesStore, currentUserStore } from "./chat";
import { immutableStore } from "./immutable";

const ONE_MINUTE = 60 * 1000;
const ONE_HOUR = 60 * ONE_MINUTE;
const USER_UPDATE_INTERVAL = ONE_MINUTE;
const MAX_USERS_TO_UPDATE_PER_BATCH = 100;

export const currentUserKey = Symbol();
export const OPENCHAT_BOT_USER_ID = "zzyk3-openc-hatbo-tq7my-cai";
export const OPENCHAT_BOT_USERNAME = "OpenChatBot";
export const OPENCHAT_BOT_AVATAR_URL = "assets/bots/robot.svg";
const openChatBotUser: PartialUserSummary = {
    kind: "bot",
    userId: OPENCHAT_BOT_USER_ID,
    username: OPENCHAT_BOT_USERNAME,
    lastOnline: 0,
    updated: BigInt(0),
    blobUrl: OPENCHAT_BOT_AVATAR_URL,
};

export const PROPOSALS_BOT_USER_ID = "process.env.PROPOSALS_BOT_CANISTER";
export const PROPOSALS_BOT_USERNAME = "ProposalsBot";
export const PROPOSALS_BOT_AVATAR_URL = "assets/bots/vote2.svg";
const proposalsBotUser: PartialUserSummary = {
    kind: "bot",
    userId: PROPOSALS_BOT_USER_ID,
    username: PROPOSALS_BOT_USERNAME,
    lastOnline: 0,
    updated: BigInt(0),
    blobUrl: PROPOSALS_BOT_AVATAR_URL,
};

const { subscribe, update, set } = immutableStore<UserLookup>({
    [OPENCHAT_BOT_USER_ID]: openChatBotUser,
    [PROPOSALS_BOT_USER_ID]: proposalsBotUser,
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
        users[OPENCHAT_BOT_USER_ID] = openChatBotUser;
        users[PROPOSALS_BOT_USER_ID] = proposalsBotUser;
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

async function updateUsers(api: ServiceContainer) {
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
        rollbar.error("Error updating users", err as Error);
    }
}

export function startUserUpdatePoller(api: ServiceContainer): Poller {
    return new Poller(() => updateUsers(api), USER_UPDATE_INTERVAL, USER_UPDATE_INTERVAL);
}
