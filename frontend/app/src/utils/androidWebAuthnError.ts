import { AndroidWebAuthnErrorCode } from "tauri-plugin-oc-api";

export type AndroidWebAuthnSignInFailure =
    | { kind: "cancelled" }
    | { kind: "link_account"; errorCode: AndroidWebAuthnErrorCode.AuthNoPasskey }
    | { kind: "error"; errorCode: AndroidWebAuthnErrorCode | "default" };

const SIGN_IN_ERROR_CODES = new Set<AndroidWebAuthnErrorCode>([
    AndroidWebAuthnErrorCode.AuthEmptyResponse,
    AndroidWebAuthnErrorCode.AuthNoPasskey,
    AndroidWebAuthnErrorCode.AuthDeviceNotSupported,
    AndroidWebAuthnErrorCode.AuthTransientError,
    AndroidWebAuthnErrorCode.AuthCredentialError,
    AndroidWebAuthnErrorCode.AuthFetchFailed,
    AndroidWebAuthnErrorCode.CommonUserCancelled,
    AndroidWebAuthnErrorCode.CommonSystemNotReady,
    AndroidWebAuthnErrorCode.CommonNoLockScreen,
    AndroidWebAuthnErrorCode.CommonSecurityDenied,
    AndroidWebAuthnErrorCode.CommonDomPasskeyError,
    AndroidWebAuthnErrorCode.CommonInterrupted,
]);

export function classifyAndroidWebAuthnSignInFailure(error: unknown): AndroidWebAuthnSignInFailure {
    const errorCode =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof error.code === "string" &&
        SIGN_IN_ERROR_CODES.has(error.code as AndroidWebAuthnErrorCode)
            ? (error.code as AndroidWebAuthnErrorCode)
            : undefined;

    switch (errorCode) {
        case AndroidWebAuthnErrorCode.CommonUserCancelled:
            return { kind: "cancelled" };
        case AndroidWebAuthnErrorCode.AuthNoPasskey:
            return { kind: "link_account", errorCode };
        default:
            return { kind: "error", errorCode: errorCode ?? "default" };
    }
}
