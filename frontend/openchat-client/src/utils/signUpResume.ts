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
 * How an identity load that got no OpenChat identity for its principal ends: signed out either way
 * (#9635). The session stored from before (`fromStorage`: the page loading) is a passkey sign-up
 * interrupted before its account was made, by a reload or the app being closed, that can't be
 * carried on (its passkey's key or credential id gone), so the page that follows says why. A
 * sign-in going on now ends in its own flow's failure.
 */
export function withoutOpenChatIdentity(fromStorage: boolean): "sign_out" | "sign_up_interrupted" {
    return fromStorage ? "sign_up_interrupted" : "sign_out";
}
