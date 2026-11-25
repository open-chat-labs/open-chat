import type { VaultLogEntry, VaultLogResponse } from "@client";
import { describe, expect, test } from "vitest";
import { VaultAccessLog, fetchFileAccessLog } from "./vaultAccessLog.svelte";

function entry(index: number, timestamp: bigint): VaultLogEntry {
    return { index: BigInt(index), timestamp, event: `e${index}` } as unknown as VaultLogEntry;
}

describe("the vault access log", () => {
    test("pages through a file's log until the bucket has no more", async () => {
        const starts: bigint[] = [];
        const client = {
            vaultLog: async (_c: string, start: bigint): Promise<VaultLogResponse> => {
                starts.push(start);
                const entries = start < 2n ? [entry(Number(start), start)] : [];
                return { kind: "success", entries, total: 2n } as VaultLogResponse;
            },
        };
        const log = await fetchFileAccessLog(client, { canisterId: "b", blobId: 1n });
        expect(starts).toEqual([0n, 1n]);
        expect(log.map((e) => e.canisterId)).toEqual(["b", "b"]);
    });

    test("never silently truncates: a bucket that never ends is a failure", async () => {
        const client = {
            vaultLog: async (): Promise<VaultLogResponse> =>
                ({ kind: "success", entries: [entry(0, 0n)], total: 1_000_000n }) as VaultLogResponse,
        };
        await expect(fetchFileAccessLog(client, { canisterId: "b", blobId: 1n })).rejects.toThrow();
    });

    test("every file's entries, in time order; a refused page fails it all", async () => {
        const client = {
            vaultLog: async (c: string): Promise<VaultLogResponse> =>
                ({
                    kind: "success",
                    entries: c === "a" ? [entry(0, 5n)] : [entry(0, 2n)],
                    total: 1n,
                }) as VaultLogResponse,
        };
        const log = new VaultAccessLog(client, [
            { canisterId: "a", blobId: 1n },
            { canisterId: "b", blobId: 2n },
        ]);
        expect(log.loading).toBe(true);
        await log.load();
        expect(log.loading).toBe(false);
        expect(log.entries.map((e) => e.canisterId)).toEqual(["b", "a"]);

        const refused = new VaultAccessLog(
            { vaultLog: async () => ({ kind: "not_authorized" }) as VaultLogResponse },
            [{ canisterId: "a", blobId: 1n }],
        );
        await refused.load();
        expect(refused.failed).toBe(true);
        expect(refused.loading).toBe(false);
    });
});
