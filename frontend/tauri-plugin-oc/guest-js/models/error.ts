// Represents possible errors returned by the Tauri OC plugin
export enum AndroidWebAuthnErrorCode {
    // Create passkey errors
    CreateProviderError = "systemProviderError",
    CreateNoProviders = "noProviders",
    CreatePasskeyAlreadyExists = "passkeyAlreadyExists", // for "this" account
    CreatePasskeyeFailed = "passkeyCreateFailed",

    // Sign in errors
    AuthEmptyResponse = "authEmptyResponse",
    AuthNoPasskey = "noPasskey",
    AuthDeviceNotSupported = "deviceNotSupported",
    AuthTransientError = "transientSystemError",
    AuthCredentialError = "credentialError",
    AuthFetchFailed = "passkeyFetchFailed",

    // Common errors
    CommonUserCancelled = "userCancelled",
    CommonSystemNotReady = "systemNotReady", // issue with play services, or maybe even due to missing lock screen
    CommonNoLockScreen = "noLockScreen",
    CommonSecurityDenied = "securityDenied",
    CommonDomPasskeyError = "domPasskeyError",
    CommonInterrupted = "interrupted", // for example call received

    // Other errors, not necessarily returned by the tauri plugin
    JsonAuthDataError = "jsonAuthDataError", // tauri plugin returned malformed data!
    MissingErrorIdentifier = "missingErrorIdentifier", // unknown, probably new error added, but not handled
    FailedToCacheWebAuthnKey = "failedToCacheWebAuthnKey", // failed to cache webauthn key to the backend
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
            code: AndroidWebAuthnErrorCode.JsonAuthDataError,
            msg: "Auth data received from the credentials manager is malformed json",
        };
    }
}

function errorCodeFromStr(c: string): AndroidWebAuthnErrorCode {
    switch (c) {
        // Create passkey errors
        case "SYSTEM_PROVIDER_ERROR":
            return AndroidWebAuthnErrorCode.CreateProviderError;
        case "NO_PROVIDERS":
            return AndroidWebAuthnErrorCode.CreateNoProviders;
        case "PASSKEY_ALREADY_EXISTS":
            return AndroidWebAuthnErrorCode.CreatePasskeyAlreadyExists;
        case "PASSKEY_CREATE_FAILED":
            return AndroidWebAuthnErrorCode.CreatePasskeyeFailed;

        // Sign in errors
        case "AUTH_EMPTY_RESPONSE":
            return AndroidWebAuthnErrorCode.AuthEmptyResponse;
        case "NO_PASSKEY":
            return AndroidWebAuthnErrorCode.AuthNoPasskey;
        case "DEVICE_NOT_SUPPORTED":
            return AndroidWebAuthnErrorCode.AuthDeviceNotSupported;
        case "TRANSIENT_SYSTEM_ERROR":
            return AndroidWebAuthnErrorCode.AuthTransientError;
        case "CREDENTIAL_ERROR":
            return AndroidWebAuthnErrorCode.AuthCredentialError;
        case "PASSKEY_FETCH_FAILED":
            return AndroidWebAuthnErrorCode.AuthFetchFailed;

        // Common errors
        case "USER_CANCELLED":
            return AndroidWebAuthnErrorCode.CommonUserCancelled;
        case "SYSTEM_NOT_READY":
            return AndroidWebAuthnErrorCode.CommonSystemNotReady;
        case "NO_SCREEN_LOCK":
            return AndroidWebAuthnErrorCode.CommonNoLockScreen;
        case "SECURITY_DENIED":
            return AndroidWebAuthnErrorCode.CommonSecurityDenied;
        case "DOM_PASSKEY_ERROR":
            return AndroidWebAuthnErrorCode.CommonDomPasskeyError;
        case "INTERRUPTED":
            return AndroidWebAuthnErrorCode.CommonInterrupted;
        default:
            console.warn("Missing error identifier for error code in AndroidWebAuth errors!", c);
            return AndroidWebAuthnErrorCode.MissingErrorIdentifier;
    }
}
