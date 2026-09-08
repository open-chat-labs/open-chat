import providers from "./passkeyProviders.json";

// Maps a WebAuthn AAGUID to a passkey provider name so the linked accounts list can tell one
// passkey from another.
//
// passkeyProviders.json is the name field of combined_aaguid.json from
// https://github.com/passkeydeveloper/passkey-authenticator-aaguids (icons deliberately omitted).

export function formatAaguid(aaguid: Uint8Array): string | undefined {
    if (aaguid.length !== 16 || aaguid.every((b) => b === 0)) {
        // Some authenticators deliberately report all zeros; that is not an identity.
        return undefined;
    }
    const hex = [...aaguid].map((b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function passkeyProviderName(aaguid: Uint8Array): string | undefined {
    const key = formatAaguid(aaguid);
    if (key === undefined) return undefined;
    return (providers as Record<string, string>)[key];
}
