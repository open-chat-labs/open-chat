import {
    Certificate,
    type HttpAgent,
    type Identity,
    LookupPathStatus,
    polling,
    type RequestId,
} from "@icp-sdk/core/agent";
import { Type } from "@sinclair/typebox";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TypeboxValidationError } from "@shared";
import { CommunitySendMessageResponse } from "../../typebox";
import { serializeToMsgPack } from "../../utils/msgpack";
import { SingleCanisterMsgpackAgent } from "./msgpack";

vi.mock("@icp-sdk/core/agent", async (importOriginal) => {
    const original = await importOriginal<typeof import("@icp-sdk/core/agent")>();
    return { ...original, polling: { ...original.polling, pollForResponse: vi.fn() } };
});

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

describe("MsgpackCanisterAgent.executeMsgpackUpdate", () => {
    const requestId = new Uint8Array([1, 2, 3]) as unknown as RequestId;

    class TestAgent extends SingleCanisterMsgpackAgent {
        constructor(agent: HttpAgent) {
            super({} as Identity, agent, "rrkah-fqaaa-aaaaa-aaaaq-cai", "test");
        }

        send(): Promise<unknown> {
            return this.update(
                "send_message",
                {},
                (resp) => resp,
                Type.Object({}),
                CommunitySendMessageResponse,
            );
        }
    }

    function agentReturning(status: number, body: unknown): HttpAgent {
        return {
            rootKey: new Uint8Array(),
            call: vi.fn().mockResolvedValue({ requestId, response: { status, body } }),
        } as unknown as HttpAgent;
    }

    function certificateWith(entries: Record<string, string>): Certificate {
        return {
            lookup_path: (path: (string | Uint8Array)[]) => {
                const key = path[path.length - 1] as string;
                const value = entries[key];
                return value === undefined
                    ? { status: LookupPathStatus.Absent }
                    : {
                          status: LookupPathStatus.Found,
                          value: Uint8Array.from(new TextEncoder().encode(value)),
                      };
            },
        } as unknown as Certificate;
    }

    beforeEach(() => {
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.mocked(polling.pollForResponse).mockReset();
    });

    // Invariant 1 (#9703): a v4 sync-call response whose certificate has no status for the
    // request resolves through polling instead of throwing.
    test("a v4 certificate with no status for the request falls back to polling", async () => {
        vi.spyOn(Certificate, "create").mockResolvedValue(certificateWith({}));
        vi.mocked(polling.pollForResponse).mockResolvedValue({
            reply: serializeToMsgPack({
                Success: { event_index: 1, message_index: 2, timestamp: 3 },
            }),
        } as Awaited<ReturnType<typeof polling.pollForResponse>>);

        const agent = agentReturning(200, { certificate: new Uint8Array() });
        const out = await new TestAgent(agent).send();

        expect(out).toEqual({
            Success: { event_index: 1, message_index: 2, timestamp: BigInt(3) },
        });
        expect(polling.pollForResponse).toHaveBeenCalledTimes(1);
    });

    // Invariant 2 (#9703): an update response no branch handles throws an error whose message
    // names the HTTP status and the certificate status.
    test("an unhandled v4 status names the HTTP and certificate status", async () => {
        vi.spyOn(Certificate, "create").mockResolvedValue(
            certificateWith({ status: "processing" }),
        );

        const agent = agentReturning(200, { certificate: new Uint8Array() });

        await expect(new TestAgent(agent).send()).rejects.toThrow(
            /HTTP status: 200\. Certificate status: processing/,
        );
        expect(polling.pollForResponse).not.toHaveBeenCalled();
    });

    test("a v4 reply with no reply data names the certificate status", async () => {
        vi.spyOn(Certificate, "create").mockResolvedValue(certificateWith({ status: "replied" }));

        const agent = agentReturning(200, { certificate: new Uint8Array() });

        await expect(new TestAgent(agent).send()).rejects.toThrow(
            /HTTP status: 200\. Certificate status: replied without a reply/,
        );
    });

    test("a 200 with neither a v4 nor a v2 body says so", async () => {
        const agent = agentReturning(200, null);

        await expect(new TestAgent(agent).send()).rejects.toThrow(
            /HTTP status: 200\. Certificate status: no v4 body/,
        );
    });
});
