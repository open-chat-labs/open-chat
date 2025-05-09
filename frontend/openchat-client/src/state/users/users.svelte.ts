// Not reallly sure whether to make this separate or not yet. Feels like a thing.
import {
    type ReadonlyMap,
    type ReadonlySet,
    type UserLookup,
    type UserSummary,
} from "openchat-shared";
import { SvelteMap, SvelteSet } from "svelte/reactivity";
import { localUpdates } from "../global";

export class UsersState {
    #serverBlockedUsers = new SvelteSet<string>();
    #blockedUsers = $derived(localUpdates.blockedDirectUsers.apply(this.#serverBlockedUsers));
    #normalUsers = $state(new SvelteMap<string, UserSummary>());
    #specialUsers = new SvelteMap<string, UserSummary>();
    #allUsers = $derived.by(() => {
        return [...this.#specialUsers.entries()].reduce((all, [k, v]) => {
            all.set(k, v);
            return all;
        }, this.#normalUsers);
    });
    #suspendedUsers = $derived.by(() => {
        const suspended = new Map<string, UserSummary>();
        for (const [k, v] of this.#allUsers) {
            if (v.suspended) {
                suspended.set(k, v);
            }
        }
        return suspended;
    });

    setBlockedUsers(userIds: string[]) {
        this.#serverBlockedUsers = new SvelteSet(userIds);
    }

    blockUser(userId: string) {
        if (!this.#serverBlockedUsers.has(userId)) {
            this.#serverBlockedUsers.add(userId);
        }
    }

    unblockUser(userId: string) {
        if (this.#serverBlockedUsers.has(userId)) {
            this.#serverBlockedUsers.delete(userId);
        }
    }

    setUsers(users: UserLookup) {
        this.#normalUsers = new SvelteMap(users);
    }

    addUser(user: UserSummary) {
        if (!this.#normalUsers.has(user.userId)) {
            this.#normalUsers.set(user.userId, user);
        }
    }

    addMany(users: UserSummary[]) {
        users.forEach((u) => this.addUser(u));
    }

    setUpdated(userIds: string[], timestamp: bigint) {
        for (const userId of userIds) {
            const user = this.#normalUsers.get(userId);
            if (user !== undefined) {
                user.updated = timestamp;
            }
        }
    }

    get(userId: string): UserSummary | undefined {
        return this.#allUsers.get(userId);
    }

    has(userId: string): boolean {
        return this.#allUsers.has(userId);
    }

    get blockedUsers(): ReadonlySet<string> {
        return this.#blockedUsers;
    }

    get allUsers(): ReadonlyMap<string, UserSummary> {
        return this.#allUsers;
    }

    get specialUsers(): ReadonlyMap<string, UserSummary> {
        return this.#specialUsers;
    }

    get suspendedUsers(): ReadonlyMap<string, UserSummary> {
        return this.#suspendedUsers;
    }

    addSpecialUsers(users: [string, UserSummary][]) {
        this.#specialUsers = new SvelteMap(users);
    }
}

export const userStore = new UsersState();
