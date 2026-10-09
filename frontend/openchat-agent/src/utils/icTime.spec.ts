import type { HttpAgent } from "@icp-sdk/core/agent";
import type { Principal } from "@icp-sdk/core/principal";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { icNowNanos, READ_IC_TIME_TIMEOUT_MS } from "./icTime";

const LEDGER = "2ouva-viaaa-aaaaq-aaamq-cai";
const DEVICE_NOW_MS = 1_791_565_000_000;
const nanos = (ms: number) => BigInt(ms) * 1_000_000n;

describe("reading the time on the IC", () => {
    let syncedWith: string[];
    let sync: () => Promise<void>;
    let timeDiffMsecs: number;

    const agent = {
        syncTime: (canisterId: Principal) => {
            syncedWith.push(canisterId.toText());
            return sync();
        },
        getTimeDiffMsecs: () => timeDiffMsecs,
    } as unknown as HttpAgent;

    beforeEach(() => {
        syncedWith = [];
        sync = () => Promise.resolve();
        timeDiffMsecs = 0;
        vi.spyOn(Date, "now").mockReturnValue(DEVICE_NOW_MS);
        vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    test("the time is read from the ledger's subnet", async () => {
        timeDiffMsecs = -160_000;

        expect(await icNowNanos(agent, LEDGER)).toEqual(nanos(DEVICE_NOW_MS - 160_000));
        expect(syncedWith).toEqual([LEDGER]);
    });

    test("if the time can't be read, the agent's last reading is used", async () => {
        sync = () => Promise.reject(new Error("unreachable"));
        timeDiffMsecs = -160_000;

        expect(await icNowNanos(agent, LEDGER)).toEqual(nanos(DEVICE_NOW_MS - 160_000));
    });

    test("if the time has never been read, the device's clock is used", async () => {
        sync = () => Promise.reject(new Error("unreachable"));

        expect(await icNowNanos(agent, LEDGER)).toEqual(nanos(DEVICE_NOW_MS));
    });

    // The agent shares a reading between every caller, so one stuck on a dead connection would
    // otherwise hold up every payment after it
    test("a reading which doesn't complete is given up on", async () => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        sync = () => new Promise(() => {});
        timeDiffMsecs = -160_000;

        const now = icNowNanos(agent, LEDGER);
        await vi.advanceTimersByTimeAsync(READ_IC_TIME_TIMEOUT_MS);

        expect(await now).toEqual(nanos(DEVICE_NOW_MS - 160_000));
    });
});
