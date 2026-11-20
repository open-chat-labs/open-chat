/**
 * Brings in the users a folded chats answer names (`fetchMissing`: the ones the user store
 * doesn't hold yet) and resolves when the fold may go on.
 *
 * On the initial load the chats come from the cached snapshot, and they are shown straight away:
 * the fold waits only for the cached users (`cachedUsersLoaded`, read from the local cache), so
 * that only users the cache doesn't hold are fetched, and leaves the fetch to fill in the rest as
 * it arrives. Waiting for it held the first chat list on the network, up to the query timeout
 * on one that hangs (#10563). Every tree's rows follow the user store, so a name that arrives
 * later shows when it does.
 *
 * A later answer came from the network itself, and its new chats wait for their users as before.
 */
export async function usersForFold(
    initialLoad: boolean,
    cachedUsersLoaded: Promise<unknown>,
    fetchMissing: () => Promise<unknown>,
): Promise<void> {
    if (!initialLoad) {
        await fetchMissing();
        return;
    }
    await cachedUsersLoaded.catch(() => undefined);
    fetchMissing().catch((err) => console.warn("Failed to load the chats' users", err));
}
