import { WebAuthnIdentity } from "@dfinity/identity";
import borc from "borc";
import {
    DER_COSE_OID,
    type PublicKey,
    type Signature,
    SignIdentity,
    unwrapDER,
} from "@dfinity/agent";
import type { WebAuthnKeyFull } from "openchat-shared";

export async function createWebAuthnIdentity(
    origin: string,
    saveKeyInCacheFn: (key: WebAuthnKeyFull) => Promise<void>,
): Promise<WebAuthnIdentity> {
    const opts = webAuthnCreationOptions(origin);
    const credential = (await navigator.credentials.create({
        publicKey: opts,
    })) as PublicKeyCredential | null;
    if (credential == null || credential.type !== "public-key") {
        throw new Error("Failed to create a WebAuthn identity");
    }

    const response = credential.response as AuthenticatorAttestationResponse;
    const publicKey = response.getPublicKey();
    if (response.attestationObject == null || publicKey == null) {
        throw new Error("Invalid attestation response");
    }

    const attObject = borc.decodeFirst(new Uint8Array(response.attestationObject));
    const authenticatorAttachment =
        credential.authenticatorAttachment === "platform" ? "platform" : "cross-platform";

    const identity = new WebAuthnIdentity(
        credential.rawId,
        authDataToCose(attObject.authData),
        authenticatorAttachment,
    );

    // A guid identifying the model of the authenticator (eg. fbfc3007-154e-4ecc-8c0b-6e020557d7bd = iCloud Keychain)
    const aaguid = new Uint8Array(response.getAuthenticatorData().slice(37, 53));

    await saveKeyInCacheFn({
        publicKey: new Uint8Array(identity.getPublicKey().toDer()),
        credentialId: new Uint8Array(credential.rawId),
        origin,
        crossPlatform: authenticatorAttachment === "cross-platform",
        aaguid,
    });

    return identity;
}

export class MultiWebAuthnIdentity extends SignIdentity {
    protected _actualIdentity?: WebAuthnIdentity;

    public constructor(
        readonly rpId: string | undefined,
        readonly lookupPubKeyFn: (credentialId: Uint8Array) => Promise<Uint8Array>,
    ) {
        super();
        this._actualIdentity = undefined;
    }

    public getPublicKey(): PublicKey {
        return this.innerIdentity().getPublicKey();
    }

    public innerIdentity(): WebAuthnIdentity {
        if (this._actualIdentity === undefined) {
            throw new Error("cannot use innerIdentity() before a successful sign()");
        } else {
            return this._actualIdentity;
        }
    }

    public async sign(blob: ArrayBuffer): Promise<Signature> {
        if (this._actualIdentity !== undefined) {
            return this._actualIdentity.sign(blob);
        }

        const options: CredentialRequestOptions = {
            publicKey: {
                challenge: blob,
                userVerification: "preferred",
                rpId: this.rpId,
            },
        };
        const result = (await navigator.credentials.get(options)) as PublicKeyCredential | null;

        if (result == null) {
            throw new Error("internal error");
        }

        const pubkey = await this.lookupPubKeyFn(new Uint8Array(result.rawId));

        this._actualIdentity = new WebAuthnIdentity(
            result.rawId,
            unwrapDER(pubkey, DER_COSE_OID),
            undefined,
        );

        const response = result.response as AuthenticatorAssertionResponse;
        const cbor = borc.encode(
            new borc.Tagged(55799, {
                authenticator_data: new Uint8Array(response.authenticatorData),
                client_data_json: new TextDecoder().decode(response.clientDataJSON),
                signature: new Uint8Array(response.signature),
            }),
        );
        // eslint-disable-next-line
        if (!cbor) {
            throw new Error("failed to encode cbor");
        }
        return new Uint8Array(cbor).buffer as Signature;
    }
}

function webAuthnCreationOptions(rpId?: string): PublicKeyCredentialCreationOptions {
    const now = new Date();
    const year = now.getFullYear().toString().substring(2);
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const day = now.getDate().toString().padStart(2, "0");
    const hour = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const suffix = year + month + day + hour + minutes;
    return {
        authenticatorSelection: {
            userVerification: "preferred",
            requireResidentKey: true,
        },
        excludeCredentials: [],
        challenge: window.crypto.getRandomValues(new Uint8Array(16)),
        pubKeyCredParams: [
            {
                type: "public-key",
                // alg: PubKeyCoseAlgo.ECDSA_WITH_SHA256
                alg: -7,
            },
            {
                type: "public-key",
                // alg: PubKeyCoseAlgo.RSA_WITH_SHA256
                alg: -257,
            },
        ],
        rp: {
            name: "OpenChat",
            id: rpId,
        },
        user: {
            id: window.crypto.getRandomValues(new Uint8Array(16)),
            name: `OpenChat-${suffix}`,
            displayName: `OpenChat-${suffix}`,
        },
    };
}

function authDataToCose(authData: ArrayBuffer): ArrayBuffer {
    const dataView = new DataView(new ArrayBuffer(2));
    const idLenBytes = authData.slice(53, 55);
    [...new Uint8Array(idLenBytes)].forEach((v, i) => dataView.setUint8(i, v));
    const credentialIdLength = dataView.getUint16(0);

    // Get the public key object.
    return authData.slice(55 + credentialIdLength);
}
