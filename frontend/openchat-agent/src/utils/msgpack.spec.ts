import { describe, expect, test } from "vitest";
import { deserializeFromMsgPack, serializeToMsgPack } from "./msgpack";

describe("msgpack", () => {
    const value = {
        Success: {
            events: [
                { index: 1, timestamp: 1_700_000_000_000, event: { Message: { text: "hi" } } },
            ],
            big: BigInt("123456789012345678901234567890"),
            bytes: new Uint8Array([1, 2, 3]),
            nested: { a: null, b: undefined, c: [1, "two", 3.5] },
        },
    };

    test("round trips", () => {
        const out = deserializeFromMsgPack(serializeToMsgPack(value));
        expect(out).toEqual({
            Success: {
                events: value.Success.events,
                big: "123456789012345678901234567890",
                bytes: new Uint8Array([1, 2, 3]),
                nested: { c: [1, "two", 3.5] },
            },
        });
    });

    test("decodes a view into a larger buffer with a non-zero byteOffset", () => {
        // Reply bytes from the agent can be a subarray of a larger response buffer; the
        // decoder must honour byteOffset/byteLength rather than reading from offset 0.
        const packed = serializeToMsgPack(value);
        const padded = new Uint8Array(packed.length + 16);
        padded.set([0xff, 0xfe, 0xfd, 0xfc, 0xfb, 0xfa, 0xf9, 0xf8], 0);
        padded.set(packed, 8);
        const view = padded.subarray(8, 8 + packed.length);
        expect(view.byteOffset).toBe(8);
        expect(deserializeFromMsgPack(view)).toEqual(deserializeFromMsgPack(packed.slice()));
    });
});
