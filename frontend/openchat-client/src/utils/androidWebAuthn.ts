import { WebAuthnIdentity } from "@dfinity/identity";
import type { WebAuthnKeyFull } from "openchat-shared";
import borc from "borc";
import {
    DER_COSE_OID,
    unwrapDER,
    SignIdentity,
    type PublicKey,
    type Signature,
} from "@dfinity/agent";
import {
    signUp,
    signIn,
    type Credential,
    type SignUpCredential,
    type SignInCredential,
} from "tauri-plugin-oc-api";

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
    saveKeyInCacheFn: (key: WebAuthnKeyFull) => Promise<void>,
): Promise<WebAuthnIdentity> {
    return new Promise(async (resolve, reject) => {
        signUp()
            .then(async (credential: Credential<SignUpCredential> | null) => {
                if (!credential) {
                    reject("no credential");
                } else {
                    const attObject = borc.decodeFirst(
                        new Uint8Array(credential.response.attestationObject),
                    );
                    const identity = new WebAuthnIdentity(
                        credential.rawId.buffer as ArrayBuffer,
                        authDataToCose(attObject.authData),
                        credential.authenticatorAttachment,
                    );

                    const aaguid = new Uint8Array(
                        credential.response.authenticatorData.slice(37, 53),
                    );
                    await saveKeyInCacheFn({
                        publicKey: new Uint8Array(identity.getPublicKey().toDer()),
                        credentialId: credential.rawId,
                        origin: "oc.app",
                        crossPlatform: credential.authenticatorAttachment === "cross-platform",
                        aaguid,
                    });

                    // Resolve the identity, and stop listening for the signup event!
                    resolve(identity);
                }
            })
            .catch((err: Error) => {
                console.error("Error creating passkey: ", err);
                reject(err);
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
async function getExistingAndroidWebAuthnPasskey(
    challenge: ArrayBuffer,
): Promise<Credential<SignInCredential>> {
    return new Promise(async (resolve, reject) => {
        signIn({ challenge })
            .then(async (credential: Credential<SignInCredential> | null) => {
                if (!credential) {
                    console.error("Passkey credential not available");
                    reject("no passkey");
                } else {
                    resolve(credential);
                }
            })
            .catch((err: Error) => {
                console.error("Error signing in with passkey: ", err);
                reject(err);
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

    public constructor(protected lookupPubKeyFn: (rawId: Uint8Array) => Promise<Uint8Array>) {
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

    public async sign(blob: ArrayBuffer): Promise<Signature> {
        if (this._identity !== undefined) {
            return this._identity.sign(blob);
        }

        // Check credentials from android side, while providing the challenge!
        const credential = await getExistingAndroidWebAuthnPasskey(blob);
        const pubkey = await this.lookupPubKeyFn(credential.rawId);

        this._identity = new WebAuthnIdentity(
            credential.rawId.buffer as ArrayBuffer,
            unwrapDER(pubkey.buffer as ArrayBuffer, DER_COSE_OID).buffer as ArrayBuffer,
            credential.authenticatorAttachment,
        );

        const cbor = borc.encode(
            new borc.Tagged(55799, {
                authenticator_data: credential.response.authenticatorData,
                client_data_json: new TextDecoder().decode(credential.response.clientDataJSON),
                signature: credential.response.signature,
            }),
        );

        // eslint-disable-next-line
        if (!cbor) {
            throw new Error("failed to encode cbor");
        }
        return new Uint8Array(cbor).buffer as Signature;
    }
}

// TODO, this is duplicated/copied from the webAuthn.ts
function authDataToCose(authData: ArrayBuffer): ArrayBuffer {
    const dataView = new DataView(new ArrayBuffer(2));
    const idLenBytes = authData.slice(53, 55);
    [...new Uint8Array(idLenBytes)].forEach((v, i) => dataView.setUint8(i, v));
    const credentialIdLength = dataView.getUint16(0);

    // Get the public key object.
    return authData.slice(55 + credentialIdLength);
}
