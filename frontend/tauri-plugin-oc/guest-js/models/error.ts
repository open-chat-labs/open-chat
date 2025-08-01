// Represents possible errors returned by the Tauri OC plugin
export enum AndroidWebAuthnErrorCode {
    NoProviders = "noProviders",
    CreatePasskeyFail = "createPasskeyFail",
    UserCancelled = "userCancelled",
    NoPasskey = "noPasskey",
    AuthFailed = "authFailed",
    NoWebAuthnKey = "noWebAuthnKey",
    UnknownError = "unknownError",
}

export type AndroidWebAuthnError = {
    code: AndroidWebAuthnErrorCode;
    msg?: string;
};

export function decodePluginError(errStr: string) {
    try {
        const { code, msg }: { code: string; msg: string } = JSON.parse(errStr);
        return {
            code: errorCodeFromStr(code),
            msg,
        };
    } catch (e) {
        console.error(errStr, e);
        return {
            code: AndroidWebAuthnErrorCode.UnknownError,
            msg: "unknown error",
        };
    }
}

function errorCodeFromStr(c: string): AndroidWebAuthnErrorCode {
    switch (c) {
        case "NO_PROVIDERS":
            return AndroidWebAuthnErrorCode.NoProviders;
        case "CREATE_PASSKEY_FAIL":
            return AndroidWebAuthnErrorCode.CreatePasskeyFail;
        case "USER_CANCELLED":
            return AndroidWebAuthnErrorCode.UserCancelled;
        case "NO_PASSKEY":
            return AndroidWebAuthnErrorCode.NoPasskey;
        case "AUTH_FAILED":
            return AndroidWebAuthnErrorCode.AuthFailed;
        case "NO_WEBAUTHN_KEY":
            return AndroidWebAuthnErrorCode.NoWebAuthnKey;
        default:
            return AndroidWebAuthnErrorCode.UnknownError;
    }
}
