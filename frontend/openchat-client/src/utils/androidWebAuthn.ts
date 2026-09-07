import { WebAuthnIdentity } from "@icp-sdk/core/identity";
import {
    WEBAUTHN_KEY_CACHE_DB_NAME,
    WEBAUTHN_KEY_CACHE_STORE_NAME,
    type WebAuthnKeyFull,
} from "@shared";
import { authDataToCose } from "./webAuthn";
import borc from "borc";
import {
    DER_COSE_OID,
    unwrapDER,
    SignIdentity,
    type PublicKey,
    type Signature,
} from "@icp-sdk/core/agent";
import {
    AndroidWebAuthnErrorCode,
    signUp,
    signIn,
    decodePluginError,
    type Credential,
    type SignUpCredential,
    type SignInCredential,
    type SignInPayload,
} from "tauri-plugin-oc-api";

// The official app uses oc.app. A local sideload build supplies the private HTTPS host used as its
// Android relying party so the stored key metadata matches Credential Manager's RP-ID.
const OC_APP_ORIGIN = import.meta.env.OC_ANDROID_RP_ID ?? "oc.app";
const MAX_WEBAUTHN_CREDENTIAL_ID_BYTES = 1023;
export const ANDROID_CREDENTIAL_CACHE_TIMEOUT_MS = 1_500;

export function matchingCachedAndroidCredentialIds(
    values: unknown[],
    origin = OC_APP_ORIGIN,
): Uint8Array[] {
    return values.flatMap((value) => {
        if (
            typeof value !== "object" ||
            value === null ||
            !("origin" in value) ||
            value.origin !== origin ||
            !("credentialId" in value) ||
            !(value.credentialId instanceof Uint8Array) ||
            value.credentialId.byteLength === 0 ||
            value.credentialId.byteLength > MAX_WEBAUTHN_CREDENTIAL_ID_BYTES
        ) {
            return [];
        }
        return [value.credentialId];
    });
}

export async function cachedAndroidCredentialIds(): Promise<Uint8Array[]> {
    // These IDs only help Credential Manager discover an existing passkey. Optional cache
    // maintenance must not strand sign-in before the native authenticator is even invoked.
    return new Promise<Uint8Array[]>((resolve) => {
        let settled = false;
        let connection: IDBDatabase | undefined;
        let readTransaction: IDBTransaction | undefined;
        const finish = (ids?: Uint8Array[]) => {
            if (settled) return;
            settled = true;
            clearTimeout(deadline);
            if (ids === undefined) {
                try {
                    readTransaction?.abort();
                } catch {
                    // A failed transaction may already be finished; the connection must still close.
                }
            }
            connection?.close();
            resolve(ids ?? []);
        };
        const deadline = setTimeout(() => finish(), ANDROID_CREDENTIAL_CACHE_TIMEOUT_MS);

        try {
            if (typeof indexedDB === "undefined" || typeof indexedDB.databases !== "function") {
                finish();
                return;
            }
            void indexedDB
                .databases()
                .then((databases) => {
                    if (settled) return;
                    if (
                        !databases.some((database) => database.name === WEBAUTHN_KEY_CACHE_DB_NAME)
                    ) {
                        finish();
                        return;
                    }
                    const openRequest = indexedDB.open(WEBAUTHN_KEY_CACHE_DB_NAME);
                    openRequest.onerror = () => finish();
                    openRequest.onblocked = () => finish();
                    openRequest.onupgradeneeded = () => {
                        // The cache may have disappeared after enumeration. Never recreate or upgrade it.
                        openRequest.transaction?.abort();
                        finish();
                    };
                    openRequest.onsuccess = () => {
                        const db = openRequest.result;
                        if (settled) {
                            db.close();
                            return;
                        }
                        connection = db;
                        try {
                            if (!db.objectStoreNames.contains(WEBAUTHN_KEY_CACHE_STORE_NAME)) {
                                finish();
                                return;
                            }
                            const transaction = db.transaction(
                                WEBAUTHN_KEY_CACHE_STORE_NAME,
                                "readonly",
                            );
                            readTransaction = transaction;
                            transaction.onabort = () => finish();
                            const request = transaction
                                .objectStore(WEBAUTHN_KEY_CACHE_STORE_NAME)
                                .getAll();
                            request.onerror = () => finish();
                            request.onsuccess = () => {
                                if (settled) return;
                                try {
                                    finish(matchingCachedAndroidCredentialIds(request.result));
                                } catch {
                                    finish();
                                }
                            };
                        } catch {
                            finish();
                        }
                    };
                })
                .catch(() => finish());
        } catch {
            finish();
        }
    });
}

/**
 * Pops up a create passkey dialog for an Android user!
 *
 * Depending on which password manager a user is using, this will be a varying
 * experience. The process might ask a pin, pattern or biometrics from the user
 * to confirm their identity, but it will not work if the user has not enabled
 * these features on their device.
 *
 * @param saveKeyInCacheFn
 * @returns
 */
export async function createAndroidWebAuthnPasskeyIdentity(
    username: string,
    saveKeyInCacheFn: (key: WebAuthnKeyFull) => Promise<void>,
): Promise<WebAuthnIdentity> {
    return new Promise((resolve, reject) => {
        signUp({ username })
            .then((credential: Credential<SignUpCredential> | null) => {
                if (!credential) {
                    reject({
                        code: AndroidWebAuthnErrorCode.CreatePasskeyeFailed,
                        msg: "failed to create passkey",
                    });
                } else {
                    const credentialId = new Uint8Array(credential.rawId);
                    const attObject = borc.decodeFirst(
                        new Uint8Array(credential.response.attestationObject),
                    );

                    const identity = new WebAuthnIdentity(
                        credentialId,
                        authDataToCose(attObject.authData),
                        credential.authenticatorAttachment,
                    );

                    const aaguid = new Uint8Array(
                        credential.response.authenticatorData.slice(37, 53),
                    );
                    saveKeyInCacheFn({
                        publicKey: new Uint8Array(identity.getPublicKey().toDer()),
                        credentialId,
                        origin: OC_APP_ORIGIN,
                        crossPlatform: credential.authenticatorAttachment === "cross-platform",
                        aaguid,
                    }).then(() => {
                        // Resolve the identity
                        resolve(identity);
                    });
                }
            })
            .catch((err: string) => {
                console.error("Error creating a passkey: ", err);
                reject(decodePluginError(err));
            });
    });
}

/**
 * Pops up a dialog on Android to select a passkey!
 *
 * This function calls into native code.
 *
 * @param challenge
 * @returns
 */
export function buildAndroidPasskeySignInPayload(
    challenge: ArrayBuffer,
    credentialIds: Uint8Array[],
): SignInPayload {
    return {
        challenge,
        credentialIds: [
            ...new Set(
                credentialIds
                    .filter(
                        (credentialId) =>
                            credentialId.byteLength > 0 &&
                            credentialId.byteLength <= MAX_WEBAUTHN_CREDENTIAL_ID_BYTES,
                    )
                    .map((credentialId) =>
                        btoa(String.fromCharCode(...credentialId))
                            .replace(/\+/g, "-")
                            .replace(/\//g, "_")
                            .replace(/=+$/, ""),
                    ),
            ),
        ],
    };
}

export async function getExistingAndroidWebAuthnPasskey(
    challenge: ArrayBuffer,
    credentialIds: Uint8Array[] = [],
): Promise<Credential<SignInCredential>> {
    return new Promise((resolve, reject) => {
        signIn(buildAndroidPasskeySignInPayload(challenge, credentialIds))
            .then((credential: Credential<SignInCredential> | null) => {
                if (!credential) {
                    reject({
                        code: AndroidWebAuthnErrorCode.AuthNoPasskey,
                        msg: "passkey is not available",
                    });
                } else {
                    resolve(credential);
                }
            })
            .catch((err: string) => {
                console.error("Error signing in with passkey: ", err);
                reject(decodePluginError(err));
            });
    });
}

/**
 * Signed WebAuthn Identity type that relies on the credentials data provided
 * by querying a passkey within the local credentials manager on Android.
 *
 * Note: Only to be used for the android app.
 */
export class AndroidWebAuthnPasskeyIdentity extends SignIdentity {
    protected _identity?: WebAuthnIdentity;

    public constructor(
        readonly lookupPubKeyFn: (rawId: Uint8Array) => Promise<Uint8Array>,
        readonly credentialIds: Uint8Array[] = [],
    ) {
        super();
    }

    public getPublicKey(): PublicKey {
        if (this._identity !== undefined) {
            return this._identity.getPublicKey();
        }

        throw new Error("AndroidWebAuthnPasskeyIdentity.getPublicKey: identity is not set!");
    }

    public identity(): WebAuthnIdentity {
        if (this._identity !== undefined) {
            return this._identity;
        }

        throw new Error("AndroidWebAuthnPasskeyIdentity.identity: identity is not set!");
    }

    public async sign(blob: Uint8Array): Promise<Signature> {
        if (this._identity !== undefined) {
            return this._identity.sign(blob);
        }

        // Check credentials from android side, while providing the challenge!
        const credential = await getExistingAndroidWebAuthnPasskey(
            blob.buffer as ArrayBuffer,
            this.credentialIds,
        );
        const credentialId = credential.rawId;
        const pubkey = await this.lookupPubKeyFn(credentialId);

        this._identity = new WebAuthnIdentity(
            credentialId,
            unwrapDER(pubkey, DER_COSE_OID),
            credential.authenticatorAttachment,
        );

        const cbor = borc.encode(
            new borc.Tagged(55799, {
                authenticator_data: credential.response.authenticatorData,
                client_data_json: new TextDecoder().decode(credential.response.clientDataJSON),
                signature: credential.response.signature,
            }),
        );

        if (!cbor) {
            throw new Error("failed to encode cbor");
        }
        return new Uint8Array(cbor) as Signature;
    }
}
