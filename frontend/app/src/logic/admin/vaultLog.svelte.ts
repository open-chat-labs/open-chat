import type { OpenChat, VaultLogEntry } from "@client";

// The operator console's vault log (the old desktop's `home/admin/VaultLog`, and the new UI's
// admin screen). The vault access log is readable only by designated vault reviewers: the chain
// of custody evidence. prev_hash of each entry is the hash of the one before it, so the chain can
// be verified externally.

export const VAULT_LOG_PAGE_SIZE = 100;

const NOT_AUTHORIZED = "Not authorized - the vault log is readable by vault reviewers only";

type VaultLogClient = Pick<OpenChat, "vaultBuckets" | "vaultLog">;

/** The start of a hash, as the log's column shows it (the whole one is its title). */
export function shortHash(hash: string): string {
    return `${hash.slice(0, 12)}…`;
}

export class VaultLog {
    /** The bucket picked or typed. */
    bucketCanisterId = $state("");
    buckets = $state<string[]>([]);
    entries = $state<VaultLogEntry[]>([]);
    total = $state<bigint | undefined>(undefined);
    busy = $state(false);
    error = $state<string | undefined>(undefined);
    // The bucket whose entries are currently loaded: loadMore must page the SAME bucket even if
    // the picker has since changed, or entries from two buckets (with clashing per-bucket
    // indexes) end up interleaved in one list
    #loadedCanisterId = "";
    #client: VaultLogClient;

    constructor(client: VaultLogClient) {
        this.#client = client;
    }

    get canLoad(): boolean {
        return !this.busy && this.bucketCanisterId.trim() !== "";
    }

    get hasMore(): boolean {
        return this.total !== undefined && BigInt(this.entries.length) < this.total;
    }

    /** Lists the buckets, picking the first unless one is already picked or typed. */
    async loadBuckets(): Promise<void> {
        const buckets = await this.#client.vaultBuckets();
        this.buckets = buckets;
        if (this.bucketCanisterId === "" && buckets.length > 0) {
            this.bucketCanisterId = buckets[0];
        }
    }

    async load(): Promise<void> {
        const canisterId = this.bucketCanisterId.trim();
        if (canisterId === "" || this.busy) return;
        this.busy = true;
        this.error = undefined;
        this.entries = [];
        this.total = undefined;
        this.#loadedCanisterId = canisterId;
        try {
            const resp = await this.#client.vaultLog(
                canisterId,
                0n,
                VAULT_LOG_PAGE_SIZE,
                undefined,
            );
            if (resp.kind === "success") {
                this.entries = resp.entries;
                this.total = resp.total;
            } else {
                this.error = NOT_AUTHORIZED;
            }
        } catch {
            this.error = "Failed to fetch the vault log";
        } finally {
            this.busy = false;
        }
    }

    async loadMore(): Promise<void> {
        if (this.busy || !this.hasMore) return;
        this.busy = true;
        this.error = undefined;
        try {
            const resp = await this.#client.vaultLog(
                this.#loadedCanisterId,
                BigInt(this.entries.length),
                VAULT_LOG_PAGE_SIZE,
                undefined,
            );
            if (resp.kind === "success") {
                this.entries = [...this.entries, ...resp.entries];
                this.total = resp.total;
            } else {
                this.error = NOT_AUTHORIZED;
            }
        } catch {
            this.error = "Failed to fetch more of the vault log";
        } finally {
            this.busy = false;
        }
    }
}
