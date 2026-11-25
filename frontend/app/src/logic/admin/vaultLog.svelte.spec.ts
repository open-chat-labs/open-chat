import type { OpenChat, VaultLogEntry, VaultLogResponse } from "@client";
import { describe, expect, test, vi } from "vitest";
import { VAULT_LOG_PAGE_SIZE, VaultLog, shortHash } from "./vaultLog.svelte";

type VaultLogClient = Pick<OpenChat, "vaultBuckets" | "vaultLog">;

const entry = (index: number): VaultLogEntry => ({
    index: BigInt(index),
    timestamp: 0n,
    hash: "h",
    prevHash: "p",
    event: "e",
    userId: undefined,
});

function client(overrides: Partial<VaultLogClient> = {}): VaultLogClient {
    return {
        vaultBuckets: async () => ["bucket-a", "bucket-b"],
        vaultLog: async (_, start): Promise<VaultLogResponse> => ({
            kind: "success",
            total: 3n,
            entries: start === 0n ? [entry(0), entry(1)] : [entry(2)],
        }),
        ...overrides,
    };
}

test("shortHash", () => {
    expect(shortHash("0123456789abcdef")).toBe("0123456789ab…");
});

describe("VaultLog", () => {
    test("picks the first bucket, unless one is already picked", async () => {
        const log = new VaultLog(client());
        await log.loadBuckets();
        expect(log.buckets).toEqual(["bucket-a", "bucket-b"]);
        expect(log.bucketCanisterId).toBe("bucket-a");

        const typed = new VaultLog(client());
        typed.bucketCanisterId = "typed";
        await typed.loadBuckets();
        expect(typed.bucketCanisterId).toBe("typed");
    });

    test("pages the bucket it loaded, even after the picker changes", async () => {
        const vaultLog = vi.fn(client().vaultLog);
        const log = new VaultLog(client({ vaultLog }));
        log.bucketCanisterId = "  bucket-a ";
        expect(log.canLoad).toBe(true);
        await log.load();
        expect(log.entries).toHaveLength(2);
        expect(log.hasMore).toBe(true);

        log.bucketCanisterId = "bucket-b";
        await log.loadMore();
        expect(vaultLog.mock.calls).toEqual([
            ["bucket-a", 0n, VAULT_LOG_PAGE_SIZE, undefined],
            ["bucket-a", 2n, VAULT_LOG_PAGE_SIZE, undefined],
        ]);
        expect(log.entries).toHaveLength(3);
        expect(log.hasMore).toBe(false);

        await log.loadMore();
        expect(vaultLog).toHaveBeenCalledTimes(2);
    });

    test("does nothing without a bucket", async () => {
        const vaultLog = vi.fn(client().vaultLog);
        const log = new VaultLog(client({ vaultLog }));
        log.bucketCanisterId = "   ";
        expect(log.canLoad).toBe(false);
        await log.load();
        expect(vaultLog).not.toHaveBeenCalled();
    });

    test("says so when the caller isn't a reviewer, or the fetch fails", async () => {
        const refused = new VaultLog(
            client({ vaultLog: async () => ({ kind: "not_authorized" }) }),
        );
        refused.bucketCanisterId = "b";
        await refused.load();
        expect(refused.error).toBe(
            "Not authorized - the vault log is readable by vault reviewers only",
        );
        expect(refused.total).toBeUndefined();

        const failing = new VaultLog(client({ vaultLog: () => Promise.reject(new Error("x")) }));
        failing.bucketCanisterId = "b";
        await failing.load();
        expect(failing.error).toBe("Failed to fetch the vault log");
        expect(failing.busy).toBe(false);
    });
});
