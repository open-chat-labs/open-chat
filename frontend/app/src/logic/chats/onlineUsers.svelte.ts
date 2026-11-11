import { UserStatus } from "@client";

// Which of a list's users are online: a chat list's DM users (the old desktop avatar's dot), a
// group's members (GroupPanel's dots and its "Online now"), looked up again on the app's clock
// (`stores/time`'s `now`). It changes only when someone comes online or goes offline, so a list
// that reads it rebuilds nothing on the clock's other ticks.

/** How a user's status is looked up (client.getUserStatus). */
export type UserStatusLookup = (userId: string, now: number) => Promise<UserStatus>;

export class OnlineUsers {
    #status: UserStatusLookup;
    // the latest look-up: an older one's answer is dropped
    #asked = 0;

    /** The users found online in the latest look-up. */
    online = $state<ReadonlySet<string>>(new Set<string>());

    constructor(status: UserStatusLookup) {
        this.#status = status;
    }

    /** Looks these users up as of `now` (a tick of the clock, or the list changing). */
    async refresh(userIds: readonly string[], now: number): Promise<void> {
        const asked = ++this.#asked;
        const statuses = await Promise.all(
            userIds.map(async (userId) => {
                try {
                    return await this.#status(userId, now);
                } catch {
                    return UserStatus.None;
                }
            }),
        );
        if (asked !== this.#asked) return;
        const online = new Set(userIds.filter((_, i) => statuses[i] === UserStatus.Online));
        if (!sameUsers(online, this.online)) this.online = online;
    }

    /** Drops a look-up still on its way (the list is going away). */
    dispose(): void {
        this.#asked++;
    }
}

function sameUsers(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
    return a.size === b.size && [...a].every((userId) => b.has(userId));
}
