// Not reallly sure whether to make this separate or not yet. Feels like a thing.
import {
    type ReadonlyMap,
    type ReadonlySet,
    type UserLookup,
    type UserSummary,
} from "openchat-shared";
import { derived } from "svelte/store";
import { localUpdates } from "../global";
import { SafeMapStore } from "../map";
import { SafeSetStore } from "../set";

export const serverBlockedUsersStore = new SafeSetStore<string>();

export const blockedUsersStore = derived(
    [serverBlockedUsersStore, localUpdates.blockedDirectUsers],
    ([serverBlockedUsers, localUpdates]) => localUpdates.apply(serverBlockedUsers),
);

export const normalUsersStore = new SafeMapStore<string, UserSummary>();
export const specialUsersStore = new SafeMapStore<string, UserSummary>();
export const allUsersStore = derived(
    [normalUsersStore, specialUsersStore],
    ([normalUsers, specialUsers]) => {
        return specialUsers.reduce((all, [k, v]) => {
            all.set(k, v);
            return all;
        }, normalUsers.clone()); // this clone is necessary to prevent infinite loop but will it be a problem?
    },
);
export const suspendedUsers = derived(allUsersStore, (allUsers) => {
    const suspended = new Map<string, UserSummary>();
    for (const [k, v] of allUsers) {
        if (v.suspended) {
            suspended.set(k, v);
        }
    }
    return suspended as ReadonlyMap<string, UserSummary>;
});

export class UsersState {
    #allUsers!: ReadonlyMap<string, UserSummary>;
    #blockedUsers!: ReadonlySet<string>;
    #suspendedUsers!: ReadonlyMap<string, UserSummary>;

    constructor() {
        allUsersStore.subscribe((val) => (this.#allUsers = val));
        blockedUsersStore.subscribe((val) => (this.#blockedUsers = val));
        suspendedUsers.subscribe((val) => (this.#suspendedUsers = val));
    }

    setBlockedUsers(userIds: string[]) {
        serverBlockedUsersStore.fromSet(new Set(userIds));
    }

    blockUser(userId: string) {
        serverBlockedUsersStore.add(userId);
    }

    unblockUser(userId: string) {
        serverBlockedUsersStore.delete(userId);
    }

    setUsers(users: UserLookup) {
        normalUsersStore.fromMap(users);
    }

    addUser(user: UserSummary) {
        if (!normalUsersStore.has(user.userId)) {
            normalUsersStore.set(user.userId, user);
        }
    }

    addMany(users: UserSummary[]) {
        users.forEach((u) => this.addUser(u));
    }

    setUpdated(userIds: string[], timestamp: bigint) {
        for (const userId of userIds) {
            const user = normalUsersStore.get(userId);
            if (user !== undefined) {
                user.updated = timestamp;
                normalUsersStore.set(userId, user);
            }
        }
    }

    addSpecialUsers(users: [string, UserSummary][]) {
        specialUsersStore.fromMap(new Map(users));
    }

    get(userId: string): UserSummary | undefined {
        return this.#allUsers.get(userId);
    }

    has(userId: string): boolean {
        return this.#allUsers.has(userId);
    }

    get blockedUsers() {
        return this.#blockedUsers;
    }

    get allUsers() {
        return this.#allUsers;
    }

    get specialUsers(): ReadonlyMap<string, UserSummary> {
        return specialUsersStore;
    }

    get suspendedUsers(): ReadonlyMap<string, UserSummary> {
        return this.#suspendedUsers;
    }
}

export const userStore = new UsersState();
