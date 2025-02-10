import { WebAuthnIdentity } from "@dfinity/identity";
import borc from "borc";
import {
    DER_COSE_OID,
    type PublicKey,
    type Signature,
    SignIdentity,
    unwrapDER,
} from "@dfinity/agent";

export async function createWebAuthnIdentity(origin: string): Promise<WebAuthnIdentity> {
    const opts = webAuthnCreationOptions(origin);
    return WebAuthnIdentity.create({ publicKey: opts }).then((id) => {
        console.log(
            "WebAuthn identity created",
            id.getPrincipal().toString(),
        );
        return id;
    });
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
                userVerification: "discouraged",
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
            name: "OpenChat",
            displayName: "OpenChat",
        },
    };
}
