/** How loading an identity ended, short of throwing. */
export type IdentityLoad =
    // the user, or no account (registering), or anonymous
    | "loaded"
    // signed out instead (no OpenChat identity, or a stale local root key)
    | "signed_out"
    // the OpenChat identity loaded, but not the user: getCurrentUser failed with nothing cached
    | "user_load_failed";

/**
 * Whether start-up got as far as a user (or a sign-out, or no account) when it loaded the session
 * the last visit left. It didn't if loading the identity threw (setAuthIdentity: a network or
 * replica that refuses connections) or the user couldn't be loaded; either way the identity is left
 * loading, and the caller offers a retry. It never signs out: a network failure isn't a reason to.
 */
export async function startUpSucceeded(
    load: () => Promise<IdentityLoad>,
    log: (err: unknown) => void,
): Promise<boolean> {
    try {
        return (await load()) !== "user_load_failed";
    } catch (err) {
        log(err);
        return false;
    }
}
