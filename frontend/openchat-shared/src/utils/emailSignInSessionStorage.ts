import type { AuthClientStorage } from "@icp-sdk/auth/client";
import { ECDSAKeyIdentity } from "@icp-sdk/core/identity";

const KEY_STORAGE_EMAIL_LINK = "email_link";
const KEY_STORAGE_EMAIL_LINK_CONTEXT = "email_link_context";

export type EmailSignInSession = EmailSignInContext & {
    key: ECDSAKeyIdentity;
};

export type EmailSignInContext = {
    email: string;
    userKey: Uint8Array;
    expiration: bigint;
};

export async function storeEmailSignInSession(
    storage: AuthClientStorage,
    session: EmailSignInSession,
): Promise<void> {
    await storage.set(KEY_STORAGE_EMAIL_LINK, session.key.getKeyPair());

    await storage.set(
        KEY_STORAGE_EMAIL_LINK_CONTEXT,
        JSON.stringify({
            email: session.email,
            userKey: Array.from(session.userKey),
            expiration: session.expiration.toString(),
        }),
    );
}

export async function getEmailSignInSession(
    storage: AuthClientStorage,
): Promise<EmailSignInSession | undefined> {
    const keyPair = (await storage.get(KEY_STORAGE_EMAIL_LINK)) as CryptoKeyPair | null;
    if (keyPair == null) return undefined;
    const contextString = (await storage.get(KEY_STORAGE_EMAIL_LINK_CONTEXT)) as string | null;
    if (contextString == null) return undefined;

    const key = await ECDSAKeyIdentity.fromKeyPair(keyPair);
    const context = JSON.parse(contextString);

    return {
        key,
        email: context.email,
        userKey: Uint8Array.from(context.userKey),
        expiration: BigInt(context.expiration),
    };
}

export async function removeEmailSignInSession(storage: AuthClientStorage): Promise<void> {
    storage.remove(KEY_STORAGE_EMAIL_LINK);
    storage.remove(KEY_STORAGE_EMAIL_LINK_CONTEXT);
}
