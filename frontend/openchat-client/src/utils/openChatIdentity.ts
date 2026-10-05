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
