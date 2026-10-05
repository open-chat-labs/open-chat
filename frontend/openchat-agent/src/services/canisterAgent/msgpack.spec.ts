import { AnonymousIdentity, type HttpAgent } from "@icp-sdk/core/agent";
import { describe, expect, test, vi } from "vitest";
import { REDACTED, TypeboxValidationError } from "@shared";
import { CommunitySendMessageResponse, UnitResult, UserSetPinNumberArgs } from "../../typebox";
import { serializeToMsgPack } from "../../utils/msgpack";
import { SingleCanisterMsgpackAgent } from "./msgpack";

// deserializeResponse is the single point where every msgpack canister reply is decoded
// and validated. It is private static, so reach it through the exported subclass.
const deserializeResponse = (
    SingleCanisterMsgpackAgent as unknown as {
        deserializeResponse: (bytes: Uint8Array, validator: unknown) => unknown;
    }
).deserializeResponse;

function replyBytes(value: unknown): Uint8Array {
    // Mimic a reply that is a view into a larger buffer (non-zero byteOffset).
    const packed = serializeToMsgPack(value);
    const buffer = new Uint8Array(packed.length + 8);
    buffer.set(packed, 8);
    return buffer.subarray(8);
}

describe("MsgpackCanisterAgent.deserializeResponse", () => {
    test("decodes and validates a well-formed reply", () => {
        const out = deserializeResponse(
            replyBytes({ Success: { event_index: 1, message_index: 2, timestamp: 3 } }),
            CommunitySendMessageResponse,
        );
        expect(out).toEqual({
            Success: { event_index: 1, message_index: 2, timestamp: BigInt(3) },
        });
    });

    test("a malformed reply still throws TypeboxValidationError", () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
            for (const bad of [
                { Success: { event_index: "one", message_index: 2, timestamp: 3 } },
                { Success: { event_index: 1 } },
                { Bogus: null },
                "Success",
                42,
            ]) {
                expect(() =>
                    deserializeResponse(replyBytes(bad), CommunitySendMessageResponse),
                ).toThrow(TypeboxValidationError);
            }
        } finally {
            spy.mockRestore();
        }
    });
});

// A user canister client whose every call fails before reaching the IC
class FailingUserAgent extends SingleCanisterMsgpackAgent {
    constructor() {
        const agent = {
            call: () => Promise.reject(new Error("call failed")),
        } as unknown as HttpAgent;
        super(new AnonymousIdentity(), agent, "rrkah-fqaaa-aaaaa-aaaaq-cai", "User");
    }

    setPinNumber(args: unknown): Promise<unknown> {
        return this.update(
            "set_pin_number",
            args as UserSetPinNumberArgs,
            (resp) => resp,
            UserSetPinNumberArgs,
            UnitResult,
        );
    }
}

describe("MsgpackCanisterAgent logging", () => {
    function logged(spy: { mock: { calls: unknown[][] } }): string {
        return spy.mock.calls.map((call) => String(JSON.stringify(call.slice(1)))).join();
    }

    test("a failed update logs its args without the PIN", async () => {
        const spy = vi.spyOn(console, "log").mockImplementation(() => {});
        try {
            await expect(
                new FailingUserAgent().setPinNumber({ new: "5678", verification: { PIN: "1234" } }),
            ).rejects.toThrow();
            expect(spy).toHaveBeenCalledWith(expect.any(Error), {
                new: REDACTED,
                verification: { PIN: REDACTED },
            });
            expect(logged(spy)).not.toMatch(/1234|5678/);
        } finally {
            spy.mockRestore();
        }
    });

    test("args which fail validation are logged without the PIN", async () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        try {
            // Fails on `verification`, so typebox's own error holds the object with the PIN in it
            await expect(
                new FailingUserAgent().setPinNumber({
                    new: "5678",
                    verification: { PIN: ["1234"] },
                }),
            ).rejects.toThrow(TypeboxValidationError);
            expect(errorSpy).toHaveBeenCalledWith(
                "Typebox validation failed: ",
                { new: REDACTED, verification: { PIN: REDACTED } },
                expect.any(Error),
            );
            expect(logged(errorSpy)).not.toMatch(/1234|5678/);
            expect(logged(logSpy)).not.toMatch(/1234|5678/);
        } finally {
            errorSpy.mockRestore();
            logSpy.mockRestore();
        }
    });
});
