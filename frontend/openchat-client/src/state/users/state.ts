// Not really sure whether to make this separate or not yet. Feels like a thing.
import { type ReadonlyMap, type ReadonlySet, type UserSummary } from "openchat-shared";
import {
    allUsersStore,
    blockedUsersStore,
    serverBlockedUsersStore,
    suspendedUsersStore,
    webhookUserIdsStore,
} from "./stores";

export class UsersState {
    #allUsers!: ReadonlyMap<string, UserSummary>;
    #blockedUsers!: ReadonlySet<string>;
    #suspendedUsers!: ReadonlySet<string>;
    #specialUsers: ReadonlySet<string> = new Set();

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

    addUser(user: UserSummary) {
        allUsersStore.update((map) => {
            map.set(user.userId, user);
            return map;
        });
        this.#updateSuspended([user]);
    }

    addMany(users: UserSummary[]) {
        if (users.length === 0) return;

        allUsersStore.update((map) => {
            users.forEach((u) => map.set(u.userId, u));
            return map;
        });
        this.#updateSuspended(users);
    }

    setUpdated(userIds: string[], timestamp: bigint) {
        allUsersStore.update((map) => {
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

    userSuspended(userId: string, suspended: boolean) {
        allUsersStore.update((users) => {
            const u = users.get(userId);
            if (u) {
                u.suspended = suspended;
                console.log("Set user to suspended", u, suspended);
                users.set(userId, u);
                suspendedUsersStore.update((s) => {
                    if (suspended) {
                        s.add(userId);
                    } else {
                        s.delete(userId);
                    }
                    return s;
                });
            }
            return users;
        });
    }

    setSpecialUsers(users: UserSummary[]) {
        this.#specialUsers = new Set(users.map((u) => u.userId));
        this.addMany(users);
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
        return this.#specialUsers;
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
