import { describe, expect, test, vi } from "vitest";
import { TypeboxValidationError } from "@shared";
import { CommunitySendMessageResponse } from "../../typebox";
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
