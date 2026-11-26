import type { SignUpPasskey } from "@shared";

/**
 * The credential id an identity load creates its OpenChat identity with when the load carries on a
 * passkey sign-up from before a reload (`stored`, signUpPasskeyStorage): only for the principal it
 * was stored with, so signing in as anyone else (or signing out: `authPrincipal` undefined) never
 * sends it, and the stored one is dropped (#10596).
 */
export function resumedSignUpCredentialId(
    stored: SignUpPasskey | undefined,
    authPrincipal: string | undefined,
): Uint8Array | undefined {
    if (stored === undefined || authPrincipal === undefined) return undefined;
    return stored.authPrincipal === authPrincipal ? stored.credentialId : undefined;
}

/**
 * Whether a load that got no OpenChat identity for its principal, and is signed out for it (#9635),
 * is a passkey sign-up from before a reload that couldn't be carried on (its passkey's cached key
 * gone), which the page after the sign-out says. Only when the session from before is loading
 * (`fromStorage`) with a sign-up passkey stored for its principal (`resumingSignUp`): any other
 * session (one with an account whose identity lookup failed, say) is signed out as before, since
 * telling an account holder to create their account again would point them at a second one.
 */
export function signsOutAsInterruptedSignUp(
    fromStorage: boolean,
    resumingSignUp: boolean,
): boolean {
    return fromStorage && resumingSignUp;
}
