import {
    AuthProvider,
    i18nKey,
    type IdentityState,
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
