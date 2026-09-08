import { uint8ArrayToHexString } from "@shared";

// Maps a WebAuthn AAGUID to a passkey provider name so the linked accounts list can tell one
// passkey from another.
//
// passkeyProviders.json is the name field of combined_aaguid.json from
// https://github.com/passkeydeveloper/passkey-authenticator-aaguids (icons deliberately omitted).
// It is imported lazily so the table stays out of the main chunk.

function formatAaguid(aaguid: Uint8Array): string | undefined {
    if (aaguid.length !== 16) return undefined;
    const hex = uint8ArrayToHexString(aaguid);
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function passkeyProviderName(aaguid: Uint8Array): Promise<string | undefined> {
    const key = formatAaguid(aaguid);
    if (key === undefined) return undefined;
    const { default: providers } = await import("./passkeyProviders.json");
    return (providers as Record<string, string>)[key];
}
