import { invoke } from '@tauri-apps/api/core'
import type { SignInPayload, SignInCredential, Credential, PluginCredentialResponse} from "../models/credentials"
import { decodeAuthenticatorAttachment } from "../models/credentials"
import { base64urlToUint8Array } from "../utils/base64"

// SIGN IN!!
export async function signIn(payload?: SignInPayload): Promise<Credential<SignInCredential> | null> {
    return invoke<PluginCredentialResponse>('plugin:oc|sign_in', { payload: payload ?? {} })
        .then(({passkey}) => {
            const parsed: {[key: string]: any} = JSON.parse(passkey);

            const authenticatorAttachment = decodeAuthenticatorAttachment(parsed)
            const clientExtensionResults = parsed.clientExtensionResults ?? {};
            const id = parsed.id;
            const rawId = base64urlToUint8Array(parsed.rawId);
            const authenticatorData = base64urlToUint8Array(parsed.response.authenticatorData);
            const clientDataJSON = base64urlToUint8Array(parsed.response.clientDataJSON);
            const signature = base64urlToUint8Array(parsed.response.signature);
            const userHandle = base64urlToUint8Array(parsed.response.userHandle);

            return {
                authenticatorAttachment,
                clientExtensionResults,
                id,
                rawId,
                response: {
                    kind: "signin",
                    authenticatorData,
                    clientDataJSON,
                    signature,
                    userHandle
                },
                type: "public-key",
            }
        })
}
