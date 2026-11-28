import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { lease } from "./pool.mjs";

function pool(size: number) {
    const root = mkdtempSync(path.join(tmpdir(), "oc-e2e-pool-"));
    const poolDir = path.join(root, "pool");
    const leasesDir = path.join(root, "leases");
    mkdirSync(poolDir);
    mkdirSync(leasesDir);
    for (let i = 0; i < size; i++) {
        writeFileSync(path.join(poolDir, `${i}.json`), JSON.stringify({ username: `user${i}` }));
    }
    return { poolDir, leasesDir };
}

describe("the e2e replica's user pool", () => {
    test("no two tests in a run are given the same pool user, and none is given once the pool is used up", () => {
        const { poolDir, leasesDir } = pool(12);
        const names = Array.from({ length: 12 }, () => lease(poolDir, leasesDir)?.username);
        expect(new Set(names).size).toBe(12);
        expect(lease(poolDir, leasesDir)).toBeUndefined();
    });
});
