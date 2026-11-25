import type { BlobReference, OpenChat, VaultLogEntry } from "@client";

/** A vault log entry with the bucket it's from: log indexes are per-bucket, so (bucket, index) keys it. */
export type VaultAccessLogEntry = VaultLogEntry & { canisterId: string };

type LogClient = Pick<OpenChat, "vaultLog">;

// A single report's chain is tiny, so hitting this means the bucket is reporting an inflated total
const MAX_PAGES = 50;
const PAGE_SIZE = 200;

/**
 * Every vault access-log entry for one file. A single report's chain is short, but custody
 * evidence is never silently truncated: it keeps paging until the bucket reports no more entries
 * for the file. Throws on a failed page, or when paging doesn't end.
 */
export async function fetchFileAccessLog(
    client: LogClient,
    ref: BlobReference,
): Promise<VaultAccessLogEntry[]> {
    const acc: VaultAccessLogEntry[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
        const resp = await client.vaultLog(ref.canisterId, BigInt(acc.length), PAGE_SIZE, ref.blobId);
        if (resp.kind !== "success") throw new Error(resp.kind);
        acc.push(...resp.entries.map((e) => ({ ...e, canisterId: ref.canisterId })));
        if (resp.entries.length === 0 || BigInt(acc.length) >= resp.total) return acc;
    }
    throw new Error("vault log paging did not terminate");
}

// The vault access log of a report's media: who quarantined, viewed and decided, in order of time.
// Readable by designated vault reviewers only. Shared by the old desktop and mobile access log
// dialogs and the web's (L6c).
export class VaultAccessLog {
    entries = $state.raw<VaultAccessLogEntry[]>([]);
    loading = $state(true);
    failed = $state(false);

    #client: LogClient;
    #blobReferences: BlobReference[];

    constructor(client: LogClient, blobReferences: BlobReference[]) {
        this.#client = client;
        this.#blobReferences = blobReferences;
    }

    async load(): Promise<void> {
        try {
            const pages = await Promise.all(
                this.#blobReferences.map((ref) => fetchFileAccessLog(this.#client, ref)),
            );
            this.entries = pages.flat().sort((a, b) => Number(a.timestamp - b.timestamp));
        } catch {
            this.failed = true;
        } finally {
            this.loading = false;
        }
    }
}
