import type { HttpAgent } from "@icp-sdk/core/agent";
import type { Principal } from "@icp-sdk/core/principal";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { transferCreatedAt } from "./icTime";

const LEDGER = "2ouva-viaaa-aaaaq-aaamq-cai";
const DEVICE_NOW_MS = 1_791_565_000_000;
const nanos = (ms: number) => BigInt(ms) * 1_000_000n;

describe("stamping a transfer with the time on the IC", () => {
    let syncedWith: string[];
    let syncFails: boolean;
    let timeDiffMsecs: number;

    const agent = {
        syncTime: (canisterId: Principal) => {
            syncedWith.push(canisterId.toText());
            return syncFails ? Promise.reject(new Error("unreachable")) : Promise.resolve();
        },
        getTimeDiffMsecs: () => timeDiffMsecs,
    } as unknown as HttpAgent;

    const stamp = (createdAtNanos: bigint) =>
        transferCreatedAt(agent, { ledger: LEDGER, createdAtNanos });

    beforeEach(() => {
        syncedWith = [];
        syncFails = false;
        timeDiffMsecs = 0;
        vi.spyOn(Date, "now").mockReturnValue(DEVICE_NOW_MS);
        vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => vi.restoreAllMocks());

    test("a stamp from a device whose clock is fast is replaced with the time on the ledger's subnet", async () => {
        timeDiffMsecs = -160_000;

        expect(await stamp(nanos(DEVICE_NOW_MS))).toEqual(nanos(DEVICE_NOW_MS - 160_000));
        expect(syncedWith).toEqual([LEDGER]);
    });

    // So that a message retried with its original stamp is deduplicated by the ledger
    test("a stamp no later than the time on the IC is kept", async () => {
        timeDiffMsecs = 30_000;

        expect(await stamp(nanos(DEVICE_NOW_MS))).toEqual(nanos(DEVICE_NOW_MS));
        expect(await stamp(nanos(DEVICE_NOW_MS - 3_600_000))).toEqual(
            nanos(DEVICE_NOW_MS - 3_600_000),
        );
    });

    test("if the time can't be read, the agent's last reading is used", async () => {
        syncFails = true;
        timeDiffMsecs = -160_000;

        expect(await stamp(nanos(DEVICE_NOW_MS))).toEqual(nanos(DEVICE_NOW_MS - 160_000));
    });

    test("if the time can't be read and never has been, the device's stamp is kept", async () => {
        syncFails = true;

        expect(await stamp(nanos(DEVICE_NOW_MS))).toEqual(nanos(DEVICE_NOW_MS));
    });
});
