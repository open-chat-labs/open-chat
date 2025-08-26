// Payload sent to the native Kotlin code when signing up/creating new passkey
export type SignUpPayload = {
    username: string;
};

// Payload sent to the native Kotlin code when signing in
export type SignInPayload = {
    challenge: ArrayBuffer;
};

// Response sent back from the native Kotlin code, a JSON string!
export type PluginCredentialResponse = {
    passkey: string;
};

// Used to decode the JSON passkey received from the native Kotlin code
export type Credential<CredentialType> = {
    authenticatorAttachment: "platform" | "cross-platform";
    clientExtensionResults: object;
    id: string;
    rawId: Uint8Array;
    response: CredentialType;
    type: "public-key";
};

// Authenticator attachment decoder(ish)!
// Note: we'd preferably use something like `zod` here, but may not worth a dependency
export function decodeAuthenticatorAttachment(data: {
    [key: string]: any;
}): "platform" | "cross-platform" {
    if ("platform" === data["authenticatorAttachment"]) {
        return "platform";
    }
    if ("cross-platform" === data.authenticatorAttachment) {
        return "cross-platform";
    }
    throw new Error("Invalid authenticatorAttachment value");
}

// Depending if the user is signing up or signing in, the response will be different
export type CredentialType = SignUpCredential | SignInCredential;

// This is the response when signing up
export type SignUpCredential = {
    kind: "signup";
    attestationObject: Uint8Array;
    authenticatorData: Uint8Array;
    clientDataJSON: Uint8Array;
    publicKey: Uint8Array;
    publicKeyAlgorithm: number;
    transports: Array<string>;
};

// This is the response when signing in
export type SignInCredential = {
    kind: "signin";
    authenticatorData: Uint8Array;
    clientDataJSON: Uint8Array;
    signature: Uint8Array;
    userHandle: Uint8Array;
};
