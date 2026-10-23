import {
    AuthProvider,
    ErrorCode,
    i18nKey,
    type AuthenticationPrincipal,
    type IdentityState,
    type LinkIdentitiesResponse,
    type RemoveIdentityLinkResponse,
    type ResourceKey,
    type SignInMethod,
    type SignInOutcome,
} from "@shared";

/** The provider a sign-in method records as the one used (selectedAuthProviderStore). */
export function signInProvider(method: SignInMethod): AuthProvider {
    switch (method.kind) {
        case "passkey":
            return AuthProvider.PASSKEY;
        case "auth_client":
            return method.provider === "ii" ? AuthProvider.II : AuthProvider.NFID;
        case "wallet":
            return method.token === "eth" ? AuthProvider.ETH : AuthProvider.SOL;
    }
}

/** Why an emailed sign-in link couldn't be sent, in the app's words. */
export function emailLinkFailure(kind: string): ResourceKey {
    switch (kind) {
        case "email_invalid":
            return i18nKey("loginDialog.invalidEmail");
        case "failed_to_send_email":
            return i18nKey("loginDialog.failedToSendEmail");
        default:
            return i18nKey("loginDialog.unexpectedError");
    }
}

/**
 * Where a sign-in got to once its identity loaded: signed in, signed in without an account yet,
 * or back to anonymous (no OpenChat identity for it, so it was signed out).
 */
export function signInOutcome(state: IdentityState): SignInOutcome {
    switch (state.kind) {
        case "logged_in":
            return { kind: "logged_in" };
        case "registering":
            return { kind: "needs_account" };
        default:
            return { kind: "failed", reason: i18nKey("loginDialog.unexpectedError") };
    }
}

// ?auth=II&auth=EMAIL … narrows the sign-in options, by these names or AuthProvider's values
const QUERY_NAMES: Record<AuthProvider, string> = {
    [AuthProvider.EMAIL]: "EMAIL",
    [AuthProvider.PASSKEY]: "PASSKEY",
    [AuthProvider.II]: "II",
    [AuthProvider.ETH]: "ETH",
    [AuthProvider.SOL]: "SOL",
    [AuthProvider.NFID]: "NFID",
};

/**
 * The sign-in options on offer. Without WebAuthn only email is left, plus a passkey (the OS's)
 * and Internet Identity in the native app. `restrictTo` (`?auth=`) narrows them, ignoring the
 * bare `?auth` of the emailed link's URL, and the method `last` signed in with comes first.
 */
export function signInOptions(
    restrictTo: Iterable<string>,
    { webAuthn, native }: { webAuthn: boolean; native: boolean },
    last?: AuthProvider,
): AuthProvider[] {
    const supported = webAuthn
        ? [
              AuthProvider.EMAIL,
              AuthProvider.PASSKEY,
              AuthProvider.II,
              AuthProvider.ETH,
              AuthProvider.SOL,
              AuthProvider.NFID,
          ]
        : native
          ? [AuthProvider.EMAIL, AuthProvider.PASSKEY, AuthProvider.II]
          : [AuthProvider.EMAIL];
    const names = new Set([...restrictTo].filter((name) => name !== ""));
    const offered =
        names.size === 0
            ? supported
            : supported.filter((o) => names.has(o) || names.has(QUERY_NAMES[o]));
    return last !== undefined && offered.includes(last)
        ? [last, ...offered.filter((o) => o !== last)]
        : offered;
}

/**
 * Whether an identity someone signed in again with is the user's own: the one they're signed in
 * with, or any sign-in linked to their account (`linked` is only asked for when it isn't the
 * first). A user who signed up one way and linked another can use either.
 */
export async function isOwnPrincipal(
    principal: string,
    current: string,
    linked: () => Promise<string[]>,
): Promise<boolean> {
    if (principal === current) return true;
    return (await linked()).includes(principal);
}

/**
 * Why a sign-in method couldn't be unlinked (removeIdentityLink), or undefined when it was. The
 * one the user is signed in with can't be.
 */
export function unlinkIdentityFailure(resp: RemoveIdentityLinkResponse): ResourceKey | undefined {
    switch (resp) {
        case "success":
            return undefined;
        case "cannot_unlink_active_principal":
            return i18nKey("identity.failure.unlinkActivePrincipal");
        case "identity_link_not_found":
            return i18nKey("identity.failure.identityNotFound");
        case "user_not_found":
            return i18nKey("identity.failure.userNotFound");
        default:
            return resp satisfies never;
    }
}

/**
 * The linked sign-in methods with the one this session signed in with marked (isCurrentIdentity).
 * The backend marks it by the session's auth principal, which a passkey's linked principal never
 * is, so when a passkey's credential is the one this session used, that passkey is the one
 * marked, and only it.
 */
export function markCurrentSignIn<T extends AuthenticationPrincipal>(
    principals: T[],
    currentCredentialId: Uint8Array | undefined,
): T[] {
    const matches = (p: T) =>
        currentCredentialId !== undefined &&
        p.webAuthnKey !== undefined &&
        sameBytes(p.webAuthnKey.credentialId, currentCredentialId);
    if (!principals.some(matches)) return principals;
    return principals.map((p) => ({ ...p, isCurrentIdentity: matches(p) }));
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
    return a.length === b.length && a.every((byte, i) => byte === b[i]);
}

/**
 * How linking a sign-in method went (linkIdentities): linked, or why not, and whether the flow
 * starts over from signing in with the new method.
 */
export type LinkIdentitiesResult =
    | { kind: "linked" }
    | { kind: "failed"; reason: ResourceKey; startOver: boolean };

export function linkIdentitiesResult(resp: LinkIdentitiesResponse): LinkIdentitiesResult {
    const failed = (key: string, startOver = true): LinkIdentitiesResult => ({
        kind: "failed",
        reason: i18nKey(key),
        startOver,
    });
    if (typeof resp === "object") {
        if (resp.kind === "success") return { kind: "linked" };
        switch (resp.code) {
            case ErrorCode.PrincipalAlreadyUsed:
                return failed("identity.failure.alreadyLinked");
            case ErrorCode.MaxLinkedIdentitiesLimitReached:
                return failed("identity.failure.limitReached");
            default:
                return failed("identity.failure.link");
        }
    }
    switch (resp) {
        case "success":
            return { kind: "linked" };
        // already linked to this account: nothing to start over
        case "already_linked_to_principal":
            return failed("identity.failure.alreadyLinked", false);
        // linked to another account
        case "already_registered":
            return failed("identity.failure.alreadyLinked");
        case "linked_identities_limit_reached":
            return failed("identity.failure.limitReached");
        case "principal_mismatch":
            return failed("identity.failure.principalMismatch");
        default:
            return failed("identity.failure.link");
    }
}
