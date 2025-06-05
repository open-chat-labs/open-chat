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
    webhookUserIdsStore,
} from "./stores";

export class UsersState {
    #allUsers!: ReadonlyMap<string, UserSummary>;
    #blockedUsers!: ReadonlySet<string>;
    #suspendedUsers!: ReadonlySet<string>;

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
        this.#updateSuspended(users.values())
    }

    addUser(user: UserSummary) {
        normalUsersStore.update((map) => {
            map.set(user.userId, user);
            return map;
        });
        this.#updateSuspended([user]);
    }

    addMany(users: UserSummary[]) {
        if (users.length === 0) return;

        normalUsersStore.update((map) => {
            users.forEach((u) => map.set(u.userId, u));
            return map;
        });
        this.#updateSuspended(users);
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

    addWebhookIds(webhooks: string[]) {
        const toAdd = webhooks.filter((id) => !webhookUserIdsStore.value.has(id));
        if (toAdd.length > 0) {
            webhookUserIdsStore.update((set) => {
                for (const webhook of webhooks) {
                    set.add(webhook);
                }
                return set;
            });
        }
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

    get suspendedUsers() {
        return this.#suspendedUsers;
    }

    #updateSuspended(users: Iterable<UserSummary>) {
        const toAdd = new Set<string>();
        const toRemove = new Set<string>();
        for (const user of users) {
            if (user.suspended) {
                if (!this.#suspendedUsers.has(user.userId)) {
                    toAdd.add(user.userId);
                }
            } else if (this.#suspendedUsers.has(user.userId)) {
                toRemove.add(user.userId);
            }
        }
        if (toAdd.size > 0 || toRemove.size > 0) {
            suspendedUsersStore.update((set) => {
                for (const userId of toAdd) {
                    set.add(userId);
                }
                for (const userId of toRemove) {
                    set.delete(userId);
                }
                return set;
            });
        }
    }
}

export const userStore = new UsersState();
