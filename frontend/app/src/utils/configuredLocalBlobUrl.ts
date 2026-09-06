import type { BlobReference } from "@client";

/**
 * Match one message blob URL against the exact local blob URL pattern supplied to OpenChat.
 *
 * The development gateway port is intentionally taken from `OC_BLOB_URL_PATTERN`; it may differ
 * between preserved PocketIC environments. The pattern must still describe the tightly scoped
 * raw-localhost HTTP endpoint before callers may replace or skip the URL.
 */
export function isExactConfiguredLocalStorageBlob(
    url: string,
    ref: BlobReference | undefined,
    blobUrlPattern: string | undefined,
): boolean {
    if (ref === undefined || blobUrlPattern === undefined || blobUrlPattern.trim().length === 0) {
        return false;
    }

    try {
        // Mirror buildBlobUrl rather than independently reconstructing the configured gateway.
        const expected = new URL(
            `${blobUrlPattern
                .replace("{canisterId}", ref.canisterId)
                .replace("{blobType}", "blobs")}/${ref.blobId}`,
        );
        if (
            expected.protocol !== "http:" ||
            expected.hostname.toLowerCase() !== `${ref.canisterId.toLowerCase()}.raw.localhost` ||
            expected.username !== "" ||
            expected.password !== "" ||
            expected.search !== "" ||
            expected.hash !== ""
        ) {
            return false;
        }

        const actual = new URL(url);
        return actual.href === expected.href;
    } catch {
        return false;
    }
}
