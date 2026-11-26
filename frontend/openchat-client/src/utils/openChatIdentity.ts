import type {
    CreateOpenChatIdentityResponse,
    GetOpenChatIdentitySuccess,
    SetAuthIdentityResponse,
} from "@shared";

// Gets the OpenChat identity for a signed-in principal, creating one if the principal doesn't have
// one yet, or signs out if neither works. Without an OpenChat identity the worker's agent is
// anonymous, so loading the user would answer unknown_user and send the user into registration,
// where registerUser then fails for want of a key to sign with (#9635). Signing out removes the
// stored delegation and navigates home, which ends whichever sign-in flow was in progress.
export async function openChatIdentityOrSignOut(
    setAuthIdentityResponse: SetAuthIdentityResponse,
    create: () => Promise<CreateOpenChatIdentityResponse>,
    signOut: (reason: string) => void,
): Promise<GetOpenChatIdentitySuccess | undefined> {
    if (setAuthIdentityResponse.kind === "success") return setAuthIdentityResponse;

    if (setAuthIdentityResponse.kind !== "oc_identity_not_found") {
        signOut(`setAuthIdentity: ${setAuthIdentityResponse.kind}`);
        return undefined;
    }

    // A rejection (no IdentityAgent, no delegation, the network) leaves no identity either
    const created = await create().catch((e) => `error: ${e}`);
    if (typeof created === "object" && created.kind === "success") return created;

    signOut(`createOpenChatIdentity: ${created}`);
    return undefined;
}

/**
 * What a load does when it gets no OpenChat identity (openChatIdentityOrSignOut): a sign-in signs
 * out, but a passkey sign-up (`registering`) keeps the identity it just made, without an account,
 * so the sign-up can say it failed and make the OpenChat identity on its next try with the same
 * passkey. Signing out there left the person on the landing page with no word why (#10580).
 */
export function loadWithoutOpenChatIdentity(registering: boolean): "sign_out" | "keep_for_sign_up" {
    return registering ? "keep_for_sign_up" : "sign_out";
}

/**
 * Where a sign-up stands once its passkey's identity is signed in (registering) and before the
 * account is asked for: with an OpenChat identity it registers; without one (its load couldn't
 * make it), a try that has only just made the passkey fails, as that load has already tried, and
 * a later try makes the OpenChat identity again with the same passkey first (#10580).
 */
export function signUpOpenChatIdentity(
    hasOpenChatIdentity: boolean,
    passkeyMadeThisTry: boolean,
): "register" | "failed" | "make_again" {
    if (hasOpenChatIdentity) return "register";
    return passkeyMadeThisTry ? "failed" : "make_again";
}
