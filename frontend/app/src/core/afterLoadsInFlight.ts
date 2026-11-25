/**
 * Waits until the message list has no load in flight, for something that came in during one and
 * may be newer than what that load asked for. A chat update is the case (#10584): a new DM opened
 * by its URL starts loading from its placeholder, which knows only the "chat started" event. The
 * real chat's update, with the message, lands while that load is in flight. That load can't bring
 * the message in, and the update's own check found it busy and was dropped, so nothing loaded it.
 *
 * `inflight` gives the load in flight now, if any: a load may start as another one ends, and it's
 * waited for too. Resolves true when the caller should check now, or false once `stillWanted` says
 * it no longer should (the chat was left, say).
 */
export async function afterLoadsInFlight(
    inflight: () => Promise<unknown> | undefined,
    stillWanted: () => boolean,
): Promise<boolean> {
    let load = inflight();
    while (load !== undefined) {
        // a failed load is over too
        await load.catch(() => undefined);
        if (!stillWanted()) return false;
        load = inflight();
    }
    return stillWanted();
}
