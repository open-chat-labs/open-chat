import { WebAuthnIdentity } from "@icp-sdk/core/identity";
import type { WebAuthnKeyFull } from "openchat-shared";
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
} from "tauri-plugin-oc-api";

const OC_APP_ORIGIN = "oc.app";

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
                        code: AndroidWebAuthnErrorCode.NoPasskey,
                        msg: "no passkey available",
                    });
                } else {
                    const credentialId = new Uint8Array(credential.rawId);
                    const attObject = borc.decodeFirst(
                        new Uint8Array(credential.response.attestationObject),
                    );
                    const identity = new WebAuthnIdentity(
                        credentialId,
                        new Uint8Array(authDataToCose(attObject.authData)),
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
async function getExistingAndroidWebAuthnPasskey(
    challenge: ArrayBuffer,
): Promise<Credential<SignInCredential>> {
    return new Promise((resolve, reject) => {
        signIn({ challenge })
            .then((credential: Credential<SignInCredential> | null) => {
                if (!credential) {
                    reject({
                        code: AndroidWebAuthnErrorCode.NoPasskey,
                        msg: "Passkey credential not available",
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

    public constructor(readonly lookupPubKeyFn: (rawId: Uint8Array) => Promise<Uint8Array>) {
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
        const credential = await getExistingAndroidWebAuthnPasskey(blob.buffer as ArrayBuffer);
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

// TODO, this is duplicated/copied from the webAuthn.ts
function authDataToCose(authData: ArrayBuffer): ArrayBuffer {
    const dataView = new DataView(new ArrayBuffer(2));
    const idLenBytes = authData.slice(53, 55);
    [...new Uint8Array(idLenBytes)].forEach((v, i) => dataView.setUint8(i, v));
    const credentialIdLength = dataView.getUint16(0);

    // Get the public key object.
    return authData.slice(55 + credentialIdLength);
}
