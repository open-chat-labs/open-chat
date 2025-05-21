// Not reallly sure whether to make this separate or not yet. Feels like a thing.
import {
    type ReadonlyMap,
    type ReadonlySet,
    type UserLookup,
    type UserSummary,
} from "openchat-shared";
import {
    allUsersStore,
    blockedUsersStore,
    normalUsersStore,
    serverBlockedUsersStore,
    specialUsersStore,
    suspendedUsersStore,
} from "./stores";

export class UsersState {
    #allUsers!: ReadonlyMap<string, UserSummary>;
    #blockedUsers!: ReadonlySet<string>;
    #suspendedUsers!: ReadonlyMap<string, UserSummary>;

    constructor() {
        allUsersStore.subscribe((val) => (this.#allUsers = val));
        blockedUsersStore.subscribe((val) => (this.#blockedUsers = val));
        suspendedUsersStore.subscribe((val) => (this.#suspendedUsers = val));
    }

    setBlockedUsers(userIds: string[]) {
        serverBlockedUsersStore.set(new Set(userIds));
    }

    blockUser(userId: string) {
        serverBlockedUsersStore.update((users) => {
            users.add(userId);
            return new Set([...users]);
        });
    }

    unblockUser(userId: string) {
        serverBlockedUsersStore.update((users) => {
            if (users.has(userId)) {
                users.delete(userId);
                return new Set([...users]);
            }
            return users;
        });
    }

    setUsers(users: UserLookup) {
        normalUsersStore.set(new Map(users));
    }

    addUser(user: UserSummary) {
        normalUsersStore.update((map) => {
            map.set(user.userId, user);
            return map;
        });
    }

    addMany(users: UserSummary[]) {
        users.forEach((u) => this.addUser(u));
    }

    setUpdated(userIds: string[], timestamp: bigint) {
        normalUsersStore.update((map) => {
            for (const userId of userIds) {
                const user = map.get(userId);
                if (user !== undefined) {
                    user.updated = timestamp;
                    map.set(userId, user);
                }
            }
            return map;
        });
    }

    addSpecialUsers(users: [string, UserSummary][]) {
        specialUsersStore.set(new Map(users));
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

    get specialUsers() {
        return specialUsersStore;
    }

    get suspendedUsers(): ReadonlyMap<string, UserSummary> {
        return this.#suspendedUsers;
    }
}

export const userStore = new UsersState();
