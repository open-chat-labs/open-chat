import { invoke } from '@tauri-apps/api/core'
import type { SignUpPayload, SignUpCredential, Credential, PluginCredentialResponse} from "../models/credentials"
import { decodeAuthenticatorAttachment } from "../models/credentials"
import { base64urlToUint8Array } from "../utils/base64"

// SIGN UP!!
export async function signUp(payload?: SignUpPayload): Promise<Credential<SignUpCredential> | null> {
    return invoke<PluginCredentialResponse>('plugin:oc|sign_up', { payload: payload ?? {} })
        .then(({passkey}) => {
            const parsed: {[key: string]: any} = JSON.parse(passkey);

            const authenticatorAttachment = decodeAuthenticatorAttachment(parsed)
            const clientExtensionResults = parsed.clientExtensionResults ?? {};
            const id = parsed.id;
            const rawId = base64urlToUint8Array(parsed.rawId);
            const attestationObject = base64urlToUint8Array(parsed.response.attestationObject);
            const authenticatorData = base64urlToUint8Array(parsed.response.authenticatorData);
            const clientDataJSON = base64urlToUint8Array(parsed.response.clientDataJSON);
            const publicKey = base64urlToUint8Array(parsed.response.publicKey);
            const publicKeyAlgorithm = parsed.response.publicKeyAlgorithm;
            const transports = parsed.response.transports ?? [];

            return {
                authenticatorAttachment,
                clientExtensionResults,
                id,
                rawId,
                response: {
                    kind: "signup",
                    attestationObject,
                    authenticatorData,
                    clientDataJSON,
                    publicKey,
                    publicKeyAlgorithm,
                    transports
                },
                type: "public-key",
            }
        });
}
