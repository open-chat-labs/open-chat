/** What `FoldUsers` needs from the client */
export type FoldUsersDeps = {
    // Whether the first chat list may show before every user it names has loaded. Only the new
    // trees (src/web, src/native) set it; the old ones keep waiting for them all.
    chatsBeforeUsers: boolean;
    // Those of `userIds` the user store doesn't hold yet
    missing: (userIds: Iterable<string>) => string[];
    // Adds those of `userIds` the local cache holds to the user store, without the network
    lookUpCached: (userIds: string[]) => Promise<void>;
    // Fetches `userIds` (the client's getMissingUsers) and adds them to the user store
    fetch: (userIds: string[]) => Promise<void>;
    // Resolves after `ms`
    delay: (ms: number) => Promise<void>;
    // The users being fetched for the chats, whenever that changes (`usersLoadingStore`): only
    // with `chatsBeforeUsers`, where the chats can show before them
    onLoading: (userIds: ReadonlySet<string>) => void;
};

// How long the first chat list waits for users that weren't cached before it shows without them
export const FIRST_LIST_USERS_WAIT_MS = 2000;
// How many users the cache can lack, the current user not among them, for the first chat list to
// show without waiting for them at all: their rows fill in as they arrive
export const FEW_MISSING_USERS = 5;

/**
 * Brings in the users a folded chats answer names before the fold goes on (#10563).
 *
 * The old trees wait for every missing user, as they always have. With `chatsBeforeUsers`, the
 * first chat list doesn't wait on the network for long:
 * - the users it names are looked up in the local cache first (just those, not the whole cache);
 * - if the cache had them all, it shows straight away;
 * - if only a few others are missing, it shows straight away and they fill in as they arrive;
 * - otherwise (a new device, a cleared cache, the current user missing) it waits for them, but at
 *   most `FIRST_LIST_USERS_WAIT_MS`, so a hanging network can't hold it for the query timeout.
 *
 * A fetch still in flight is reused: a later fold naming the same users waits for it rather than
 * asking for them again. The users in flight are announced (`onLoading`) so the new trees can show
 * them as loading rather than unknown; a user leaves the set as the fetch settles, found or not.
 */
export class FoldUsers {
    readonly #deps: FoldUsersDeps;
    readonly #inFlight = new Map<string, Promise<void>>();

    constructor(deps: FoldUsersDeps) {
        this.#deps = deps;
    }

    /**
     * Resolves when the fold may go on, with a promise that settles once every user named has
     * arrived (or failed to), for anything that needs them, e.g. the current user's avatar.
     */
    async load(
        userIds: Set<string>,
        initialLoad: boolean,
        currentUserId: string | undefined,
    ): Promise<{ arrived: Promise<void> }> {
        if (!this.#deps.chatsBeforeUsers) {
            const arrived = this.#deps.fetch(this.#deps.missing(userIds));
            await arrived;
            return { arrived };
        }

        let missing = this.#deps.missing(userIds);
        const pending = new Set<Promise<void>>();
        missing = missing.filter((userId) => {
            const inFlight = this.#inFlight.get(userId);
            if (inFlight !== undefined) pending.add(inFlight);
            return inFlight === undefined;
        });

        if (initialLoad && missing.length > 0) {
            await this.#deps
                .lookUpCached(missing)
                .catch((err) => console.warn("Failed to look up the cached users", err));
            missing = this.#deps.missing(missing);
        }

        if (missing.length > 0) pending.add(this.#fetch(missing));
        const arrived = Promise.all(pending).then(() => undefined);

        if (!initialLoad) {
            await arrived;
        } else if (
            missing.length > FEW_MISSING_USERS ||
            (currentUserId !== undefined && missing.includes(currentUserId))
        ) {
            await Promise.race([arrived, this.#deps.delay(FIRST_LIST_USERS_WAIT_MS)]);
        }
        return { arrived };
    }

    #fetch(userIds: string[]): Promise<void> {
        const fetched = this.#deps
            .fetch(userIds)
            .catch((err) => console.warn("Failed to load the chats' users", err))
            .finally(() => {
                for (const userId of userIds) {
                    if (this.#inFlight.get(userId) === fetched) this.#inFlight.delete(userId);
                }
                this.#announce();
            });
        for (const userId of userIds) this.#inFlight.set(userId, fetched);
        this.#announce();
        return fetched;
    }

    #announce(): void {
        this.#deps.onLoading(new Set(this.#inFlight.keys()));
    }
}
