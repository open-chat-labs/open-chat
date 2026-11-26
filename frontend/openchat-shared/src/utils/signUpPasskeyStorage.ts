import type { AuthClientStorage } from "@icp-sdk/auth/client";

// A passkey sign-up stores its delegation as soon as the passkey is made, but the account comes
// after: the OpenChat identity, created with the passkey's credential id, then the user. A reload
// in between (a refresh, a tab the browser discarded, the app killed) loses what was in memory, so
// the credential id is stored next to the delegation, with the principal it was made for, until the
// account is made (#10596). It's only ever used for that principal's delegation.

const KEY_STORAGE_SIGN_UP_PASSKEY = "sign_up_passkey";
const KEY_STORAGE_SIGN_UP_INTERRUPTED = "sign_up_interrupted";

/** The passkey a sign-up in progress made, and the principal its delegation signs in as. */
export type SignUpPasskey = {
    authPrincipal: string;
    credentialId: Uint8Array;
};

export async function storeSignUpPasskey(
    storage: AuthClientStorage,
    passkey: SignUpPasskey,
): Promise<void> {
    await storage.set(
        KEY_STORAGE_SIGN_UP_PASSKEY,
        JSON.stringify({
            authPrincipal: passkey.authPrincipal,
            credentialId: Array.from(passkey.credentialId),
        }),
    );
}

/** The sign-up passkey stored, if any; one that can't be read counts as none. */
export async function getSignUpPasskey(
    storage: AuthClientStorage,
): Promise<SignUpPasskey | undefined> {
    const json = await storage.get(KEY_STORAGE_SIGN_UP_PASSKEY);
    if (typeof json !== "string") return undefined;
    try {
        const parsed = JSON.parse(json);
        if (typeof parsed?.authPrincipal !== "string" || !Array.isArray(parsed.credentialId)) {
            return undefined;
        }
        return {
            authPrincipal: parsed.authPrincipal,
            credentialId: Uint8Array.from(parsed.credentialId),
        };
    } catch {
        return undefined;
    }
}

export async function removeSignUpPasskey(storage: AuthClientStorage): Promise<void> {
    await storage.remove(KEY_STORAGE_SIGN_UP_PASSKEY);
}

/**
 * A sign-up that couldn't be carried on after a reload was signed out: kept over the sign-out's
 * navigation, so the page that follows can say why (takeSignUpInterrupted).
 */
export async function storeSignUpInterrupted(storage: AuthClientStorage): Promise<void> {
    await storage.set(KEY_STORAGE_SIGN_UP_INTERRUPTED, "true");
}

/** Whether a sign-up was signed out for being interrupted (storeSignUpInterrupted); once. */
export async function takeSignUpInterrupted(storage: AuthClientStorage): Promise<boolean> {
    const interrupted = (await storage.get(KEY_STORAGE_SIGN_UP_INTERRUPTED)) !== null;
    if (interrupted) await storage.remove(KEY_STORAGE_SIGN_UP_INTERRUPTED);
    return interrupted;
}
