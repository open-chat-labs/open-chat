import {
    DER_COSE_OID,
    type PublicKey,
    type Signature,
    SignIdentity,
    unwrapDER,
} from "@icp-sdk/core/agent";
import { WebAuthnIdentity } from "@icp-sdk/core/identity";
import borc from "borc";
import type { WebAuthnKeyFull } from "@shared";

export async function createWebAuthnIdentity(
    origin: string,
    saveKeyInCacheFn: (key: WebAuthnKeyFull) => Promise<void>,
    username?: string,
): Promise<WebAuthnIdentity> {
    const opts = webAuthnCreationOptions(origin, username);
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

    const credentialId = new Uint8Array(credential.rawId);
    const attObject = borc.decodeFirst(new Uint8Array(response.attestationObject));
    const authenticatorAttachment =
        credential.authenticatorAttachment === "platform" ? "platform" : "cross-platform";

    const identity = new WebAuthnIdentity(
        credentialId,
        authDataToCose(attObject.authData),
        authenticatorAttachment,
    );

    // A guid identifying the model of the authenticator (eg. fbfc3007-154e-4ecc-8c0b-6e020557d7bd = iCloud Keychain)
    const aaguid = new Uint8Array(response.getAuthenticatorData().slice(37, 53));

    await saveKeyInCacheFn({
        publicKey: new Uint8Array(identity.getPublicKey().toDer()),
        credentialId,
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

    public async sign(blob: Uint8Array): Promise<Signature> {
        if (this._actualIdentity !== undefined) {
            return this._actualIdentity.sign(blob);
        }

        const options: CredentialRequestOptions = {
            publicKey: {
                challenge: new Uint8Array(blob),
                userVerification: "preferred",
                rpId: this.rpId,
            },
        };
        const result = (await navigator.credentials.get(options)) as PublicKeyCredential | null;

        if (result == null) {
            throw new Error("internal error");
        }

        const credentialId = new Uint8Array(result.rawId);
        const pubkey = await this.lookupPubKeyFn(credentialId);

        this._actualIdentity = new WebAuthnIdentity(
            credentialId,
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

        if (!cbor) {
            throw new Error("failed to encode cbor");
        }
        return new Uint8Array(cbor) as Signature;
    }
}

function webAuthnCreationOptions(
    rpId?: string,
    username?: string,
): PublicKeyCredentialCreationOptions {
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
            name: username ? `${username}@openchat` : `OpenChat-${suffix}`,
            displayName: `OpenChat-${suffix}`,
        },
    };
}

/**
 * Extracts the COSE public key from WebAuthn authenticator data.
 *
 * Layout (https://www.w3.org/TR/webauthn-2/#sctn-authenticator-data):
 *   rpIdHash (32) | flags (1) | signCount (4) | aaguid (16) | credentialIdLength (2) |
 *   credentialId (credentialIdLength) | credentialPublicKey (COSE, variable) | extensions (CBOR map, optional)
 *
 * The public key is a CBOR map of variable length, so we must walk the CBOR structure to find where it
 * ends rather than taking everything to the end of the buffer. Otherwise, when the authenticator sets the
 * ED flag (eg. YubiKeys which add a `credProtect` extension), the extensions map would be included in the
 * stored key, the IC would reject it as malformed, and the user would be locked out of their account.
 */
export function authDataToCose(authData: ArrayBuffer | Uint8Array): Uint8Array {
    const bytes = new Uint8Array(authData);
    const credentialIdLength = new DataView(
        bytes.buffer,
        bytes.byteOffset,
        bytes.byteLength,
    ).getUint16(53);
    const start = 55 + credentialIdLength;
    const length = cborItemLength(bytes, start);
    return bytes.slice(start, start + length);
}

/**
 * Returns the encoded length in bytes of the CBOR data item starting at `offset`.
 * Only definite-length items are supported, which is all that CTAP2 canonical CBOR permits.
 */
function cborItemLength(bytes: Uint8Array, offset: number): number {
    if (offset >= bytes.length) {
        throw new Error("Unexpected end of CBOR data");
    }
    const initial = bytes[offset];
    const majorType = initial >> 5;
    const additionalInfo = initial & 0x1f;

    let headerLength = 1;
    let argument: number;
    if (additionalInfo < 24) {
        argument = additionalInfo;
    } else if (additionalInfo <= 27) {
        const argumentLength = 1 << (additionalInfo - 24);
        if (offset + 1 + argumentLength > bytes.length) {
            throw new Error("Unexpected end of CBOR data");
        }
        const view = new DataView(bytes.buffer, bytes.byteOffset + offset + 1, argumentLength);
        switch (argumentLength) {
            case 1:
                argument = view.getUint8(0);
                break;
            case 2:
                argument = view.getUint16(0);
                break;
            case 4:
                argument = view.getUint32(0);
                break;
            default:
                argument = Number(view.getBigUint64(0));
                break;
        }
        headerLength += argumentLength;
    } else {
        throw new Error("Indefinite length CBOR items are not supported");
    }

    let length = headerLength;
    switch (majorType) {
        case 0: // unsigned int
        case 1: // negative int
        case 7: // simple values and floats (argument bytes already counted in the header)
            break;
        case 2: // byte string
        case 3: // text string
            length += argument;
            break;
        case 4: // array
            for (let i = 0; i < argument; i++) {
                length += cborItemLength(bytes, offset + length);
            }
            break;
        case 5: // map
            for (let i = 0; i < argument * 2; i++) {
                length += cborItemLength(bytes, offset + length);
            }
            break;
        case 6: // tagged item
            length += cborItemLength(bytes, offset + length);
            break;
    }

    if (offset + length > bytes.length) {
        throw new Error("Unexpected end of CBOR data");
    }
    return length;
}
