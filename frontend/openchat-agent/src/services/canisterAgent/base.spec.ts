import {
    type HttpAgent,
    type Identity,
    RejectError,
    ReplicaRejectCode,
    type RequestId,
    UncertifiedRejectErrorCode,
} from "@icp-sdk/core/agent";
import { InstructionLimitExceededError } from "@shared";
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
});

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
});
