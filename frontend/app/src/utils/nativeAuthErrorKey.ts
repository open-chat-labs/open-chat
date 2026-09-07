const NATIVE_AUTH_ERROR_CODES = new Set([
    "alreadyRegistered",
    "authEmptyResponse",
    "codeInvalid",
    "credentialError",
    "createPasskeyFail",
    "default",
    "deviceNotSupported",
    "domPasskeyError",
    "interrupted",
    "linkingCodeNotFound",
    "maxLinkedIdentitiesLimitReached",
    "noLockScreen",
    "noPasskey",
    "noProviders",
    "passkeyFetchFailed",
    "securityDenied",
    "systemNotReady",
    "transientSystemError",
]);

// Authentication handlers keep raw error codes for routing. Only known display
// codes may select a translation; legacy iOS and unknown provider errors use the
// existing generic message instead of exposing a missing key or provider text.
export function nativeAuthErrorKey(error: string): string {
    return `native.auth.errors.${NATIVE_AUTH_ERROR_CODES.has(error) ? error : "default"}`;
}
