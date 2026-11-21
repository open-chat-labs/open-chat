import {
    type HttpAgent,
    type Identity,
    RejectError,
    ReplicaRejectCode,
    type RequestId,
    UncertifiedRejectErrorCode,
} from "@icp-sdk/core/agent";
import { InstructionLimitExceededError, setConnectionUnusable } from "@shared";
import { OFFLINE_RETRY_WAIT_MS } from "../../utils/waitForOnline";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CanisterAgent } from "./base";

class TestAgent extends CanisterAgent {
    constructor() {
        super({} as Identity, {} as HttpAgent, "test");
    }

    query<T>(serviceCall: () => Promise<T>): Promise<T> {
        return this.executeQuery(serviceCall, (resp) => resp);
    }
}

function reject(message: string, errorCode: string): Error {
    return RejectError.fromCode(
        new UncertifiedRejectErrorCode(
            new Uint8Array([1]) as unknown as RequestId,
            ReplicaRejectCode.CanisterError,
            message,
            errorCode,
            undefined,
        ),
    );
}

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    setConnectionUnusable(false);
});

function browserOnline(online: boolean) {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(online);
}

describe("executeQuery", () => {
    test("a query which runs out of instructions isn't retried", async () => {
        const serviceCall = vi.fn(() =>
            Promise.reject(reject("exceeded the limit of instructions", "IC0522")),
        );

        await expect(new TestAgent().query(serviceCall)).rejects.toBeInstanceOf(
            InstructionLimitExceededError,
        );
        expect(serviceCall).toHaveBeenCalledTimes(1);
    });

    test("a query which traps otherwise is retried", async () => {
        vi.useFakeTimers();
        const serviceCall = vi
            .fn<() => Promise<string>>()
            .mockRejectedValueOnce(reject("trapped", "IC0502"))
            .mockResolvedValue("ok");

        const result = new TestAgent().query(serviceCall);
        await vi.runAllTimersAsync();

        expect(await result).toBe("ok");
        expect(serviceCall).toHaveBeenCalledTimes(2);
    });

    test("a failed query's retry waits while the browser is offline and goes once it's back", async () => {
        vi.useFakeTimers();
        browserOnline(false);
        const serviceCall = vi
            .fn<() => Promise<string>>()
            .mockRejectedValueOnce(new TypeError("Failed to fetch"))
            .mockResolvedValue("ok");

        const result = new TestAgent().query(serviceCall);
        await vi.advanceTimersByTimeAsync(OFFLINE_RETRY_WAIT_MS - 1);
        expect(serviceCall).toHaveBeenCalledTimes(1);

        browserOnline(true);
        window.dispatchEvent(new Event("online"));
        await vi.advanceTimersByTimeAsync(0);
        expect(await result).toBe("ok");
        expect(serviceCall).toHaveBeenCalledTimes(2);
    });

    test("a failed query gives up when the browser stays offline", async () => {
        vi.useFakeTimers();
        browserOnline(false);
        const serviceCall = vi.fn(() => Promise.reject(new TypeError("Failed to fetch")));

        const result = new TestAgent().query(serviceCall);
        const settled = result.then(
            () => "resolved",
            () => "rejected",
        );
        await vi.advanceTimersByTimeAsync(OFFLINE_RETRY_WAIT_MS + 1_000);
        expect(await settled).toBe("rejected");
        expect(serviceCall).toHaveBeenCalledTimes(1);
    });

    test("a connection judged unusable doesn't hold up the retry", async () => {
        vi.useFakeTimers();
        setConnectionUnusable(true);
        const serviceCall = vi
            .fn<() => Promise<string>>()
            .mockRejectedValueOnce(new TypeError("Failed to fetch"))
            .mockResolvedValue("ok");

        const result = new TestAgent().query(serviceCall);
        await vi.runAllTimersAsync();

        expect(await result).toBe("ok");
        expect(serviceCall).toHaveBeenCalledTimes(2);
    });
});
