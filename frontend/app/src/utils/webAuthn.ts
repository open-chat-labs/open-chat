import { WebAuthnIdentity } from "@dfinity/identity";
import { bytesToHexString } from "openchat-agent/lib/utils/mapping";

export async function getWebAuthnCredentialId(): Promise<ArrayBuffer> {
    const options: CredentialRequestOptions = {
        publicKey: {
            challenge: window.crypto.getRandomValues(new Uint8Array(16)),
            userVerification: "discouraged",
            rpId: undefined,
        },
    };

    const result = (await navigator.credentials.get(options)) as PublicKeyCredential | null;
    if (result == null) {
        throw new Error("internal error");
    }
    return result.rawId;
}

export async function createWebAuthnIdentity(): Promise<WebAuthnIdentity> {
    const opts = webAuthnCreationOptions();
    return WebAuthnIdentity.create({ publicKey: opts }).then((id) => {
        console.log(
            "WebAuthn identity created",
            id.getPrincipal().toString(),
            bytesToHexString(new Uint8Array(id.rawId)),
            id.toJSON(),
        );
        return id;
    });
}

export function webAuthnCreationOptions(rpId?: string): PublicKeyCredentialCreationOptions {
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
