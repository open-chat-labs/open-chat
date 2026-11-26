/** How loading an identity ended, short of throwing. */
export type IdentityLoad =
    // the user, or no account (registering), or anonymous
    | "loaded"
    // signed out instead (no OpenChat identity, or a stale local root key)
    | "signed_out"
    // a passkey sign-up's identity, kept without an OpenChat identity (registering): the sign-up
    // says it failed, and its next try makes one (#10580)
    | "no_oc_identity"
    // the OpenChat identity loaded, but not the user: getCurrentUser failed with nothing cached
    | "user_load_failed";

/**
 * Whether an identity load (`attempt`) failed in a way that leaves the identity loading with
 * nothing to show, so the app offers a retry (identityLoadFailedStore): it threw (setAuthIdentity:
 * a network or replica that refuses connections), or the user couldn't be loaded. Only the latest
 * load (`latest`) says so: one that a sign-in has since replaced isn't what's showing (#10562).
 */
export function identityLoadFailed(
    result: IdentityLoad | "threw",
    attempt: number,
    latest: number,
): boolean {
    return attempt === latest && (result === "threw" || result === "user_load_failed");
}
