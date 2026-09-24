// Not really sure whether to make this separate or not yet. Feels like a thing.
import { type ReadonlyMap, type ReadonlySet, type UserSummary } from "@shared";
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
    // Users who've been migrated to a MultiUser canister are held under their latest id, and also
    // under each of their earlier ids, since chat events etc. still refer to them by those
    #latestUserIds: Map<string, string> = new Map();
    #previousUserIds: Map<string, Set<string>> = new Map();

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
            this.#set(map, user);
            return map;
        });
        this.#updateSuspended([user]);
    }

    addMany(users: UserSummary[]) {
        if (users.length === 0) return;

        allUsersStore.update((map) => {
            users.forEach((u) => this.#set(map, u));
            return map;
        });
        this.#updateSuspended(users);
    }

    // Maps each earlier id of a user who's been migrated to a MultiUser canister to their latest id
    addMigratedUserIds(migrated: ReadonlyMap<string, string>) {
        const changed = new Set<string>();
        for (const [previous, latest] of migrated) {
            if (previous === latest || this.#latestUserIds.get(previous) === latest) continue;

            // Any ids which were migrated to `previous` now resolve to `latest` too
            const ids = [previous, ...(this.#previousUserIds.get(previous) ?? [])];
            this.#previousUserIds.delete(previous);
            const formerLatest = this.#latestUserIds.get(previous);
            if (formerLatest !== undefined) {
                this.#previousUserIds.get(formerLatest)?.delete(previous);
            }

            const previousIds = this.#previousUserIds.get(latest) ?? new Set();
            for (const id of ids) {
                this.#latestUserIds.set(id, latest);
                previousIds.add(id);
            }
            this.#previousUserIds.set(latest, previousIds);
            changed.add(latest);
        }

        const users = [...changed]
            .map((userId) => this.#allUsers.get(userId))
            .filter((u) => u !== undefined);
        if (users.length === 0) return;

        allUsersStore.update((map) => {
            users.forEach((u) => this.#set(map, u));
            return map;
        });
    }

    // The id a user is held under, which is their latest id if they've been migrated
    latestUserId(userId: string): string {
        return this.#latestUserIds.get(userId) ?? userId;
    }

    #set(map: Map<string, UserSummary>, user: UserSummary) {
        map.set(user.userId, user);
        for (const previous of this.#previousUserIds.get(user.userId) ?? []) {
            map.set(previous, user);
        }
    }

    setUpdated(userIds: string[], timestamp: bigint) {
        const toUpdate = userIds.filter((id) => {
            const user = allUsersStore.value.get(id);
            return user !== undefined && user.updated !== timestamp;
        });
        if (toUpdate.length === 0) return;

        allUsersStore.update((map) => {
            for (const userId of toUpdate) {
                const user = map.get(userId);
                if (user !== undefined) {
                    user.updated = timestamp;
                    this.#set(map, user);
                }
            }
            return map;
        });
    }

    userSuspended(userId: string, suspended: boolean) {
        userId = this.latestUserId(userId);
        const existing = allUsersStore.value.get(userId);
        if (existing === undefined || existing.suspended === suspended) return;

        allUsersStore.update((users) => {
            const u = users.get(userId);
            if (u) {
                u.suspended = suspended;
                this.#set(users, u);
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

    updateUser(userId: string, updater: (user: UserSummary) => UserSummary | undefined): void {
        const user = this.get(userId);
        if (user !== undefined) {
            const updated = updater(user);
            if (updated !== undefined) {
                this.addUser(updated);
            }
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
