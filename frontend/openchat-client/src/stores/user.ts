import {
    type UserSummary,
    AIRDROP_BOT_AVATAR_URL,
    AIRDROP_BOT_USERNAME,
    ANON_AVATAR_URL,
    ANON_DISPLAY_NAME,
    ANON_USER_ID,
    ANON_USERNAME,
    OPENCHAT_BOT_AVATAR_URL,
    OPENCHAT_BOT_USER_ID,
    OPENCHAT_BOT_USERNAME,
    OPENCHAT_VIDEO_CALL_AVATAR_URL,
    OPENCHAT_VIDEO_CALL_USER_ID,
    OPENCHAT_VIDEO_CALL_USERNAME,
} from "openchat-shared";
import { AIRDROP_BOT_USER_ID } from "../constants";

export const airdropBotUser: UserSummary = {
    kind: "bot",
    userId: AIRDROP_BOT_USER_ID,
    username: AIRDROP_BOT_USERNAME,
    displayName: undefined,
    updated: BigInt(0),
    suspended: false,
    blobUrl: AIRDROP_BOT_AVATAR_URL,
    diamondStatus: "inactive",
    chitBalance: 0,
    streak: 0,
    maxStreak: 0,
    isUniquePerson: false,
    totalChitEarned: 0,
};

export const videoCallBotUser: UserSummary = {
    kind: "bot",
    userId: OPENCHAT_VIDEO_CALL_USER_ID,
    username: OPENCHAT_VIDEO_CALL_USERNAME,
    displayName: undefined,
    updated: BigInt(0),
    suspended: false,
    blobUrl: OPENCHAT_VIDEO_CALL_AVATAR_URL,
    diamondStatus: "inactive",
    chitBalance: 0,
    streak: 0,
    maxStreak: 0,
    isUniquePerson: false,
    totalChitEarned: 0,
};

export const openChatBotUser: UserSummary = {
    kind: "bot",
    userId: OPENCHAT_BOT_USER_ID,
    username: OPENCHAT_BOT_USERNAME,
    displayName: undefined,
    updated: BigInt(0),
    suspended: false,
    blobUrl: OPENCHAT_BOT_AVATAR_URL,
    diamondStatus: "inactive",
    chitBalance: 0,
    streak: 0,
    maxStreak: 0,
    isUniquePerson: false,
    totalChitEarned: 0,
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
    chitBalance: 0,
    streak: 0,
    maxStreak: 0,
    isUniquePerson: false,
    totalChitEarned: 0,
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
        chitBalance: 0,
        streak: 0,
        maxStreak: 0,
        isUniquePerson: false,
        totalChitEarned: 0,
    };
}

// export const specialUsers = writable<UserLookup>(new Map());
// const normalUsers = writable<UserLookup>(new Map());

// const allUsers = derived([specialUsers, normalUsers], ([$specialUsers, $normalUsers]) => {
//     return [...$specialUsers.entries()].reduce((all, [k, v]) => {
//         all.set(k, v);
//         return all;
//     }, $normalUsers);
// });

// export const suspendedUsers = createSetStore(writable(new Set<string>()));

// export function overwriteUser(lookup: UserLookup, user: UserSummary): UserLookup {
//     lookup.set(user.userId, { ...user });
//     return lookup;
// }

// export const userStore = {
//     subscribe: allUsers.subscribe,
//     set: (users: UserLookup): void => {
//         normalUsers.set(users);
//         const [suspended] = partitionSuspendedUsers([...users.values()]);
//         suspendedUsers.set(new Set(suspended));
//     },
//     add: (user: UserSummary): void => {
//         normalUsers.update((users) => {
//             const clone = new Map(users);
//             return overwriteUser(clone, user);
//         });
//         if (user.suspended) {
//             suspendedUsers.add(user.userId);
//         } else {
//             suspendedUsers.delete(user.userId);
//         }
//     },
//     addMany: (newUsers: UserSummary[]): void => {
//         if (newUsers.length > 0) {
//             normalUsers.update((users) => {
//                 const clone = new Map(users);
//                 return newUsers.reduce((lookup, user) => overwriteUser(lookup, user), clone);
//             });
//             const [suspended, notSuspended] = partitionSuspendedUsers(newUsers);
//             suspendedUsers.addMany(suspended);
//             suspendedUsers.deleteMany(notSuspended);
//         }
//     },
//     setUpdated: (userIds: string[], timestamp: bigint): void => {
//         normalUsers.update((users) => {
//             for (const userId of userIds) {
//                 const user = users.get(userId);
//                 if (user !== undefined) {
//                     user.updated = timestamp;
//                 }
//             }
//             return users;
//         });
//     },
// };

// function partitionSuspendedUsers(users: UserSummary[]): [string[], string[]] {
//     const suspended = [];
//     const notSuspended = [];
//     for (const user of users) {
//         if (user.suspended) {
//             suspended.push(user.userId);
//         } else {
//             notSuspended.push(user.userId);
//         }
//     }
//     return [suspended, notSuspended];
// }
