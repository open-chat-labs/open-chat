import { Principal } from "@icp-sdk/core/principal";
import { describe, expect, test } from "vitest";
import { CIRCULAR, REDACTED, redactSecrets } from "./redact";

describe("redactSecrets", () => {
    test("redacts the PIN of a canister request, leaving the rest", () => {
        const args = {
            message_id: 123n,
            content: { Crypto: { recipient: "abc", transfer: { amount: 100n } } },
            pin: "1234",
        };
        expect(redactSecrets(args, "send_message_v2")).toEqual({
            message_id: 123n,
            content: { Crypto: { recipient: "abc", transfer: { amount: 100n } } },
            pin: REDACTED,
        });
    });

    test("does not modify the request itself", () => {
        const args = { pin: "1234", inner: { pin: "5678" } };
        redactSecrets(args);
        expect(args).toEqual({ pin: "1234", inner: { pin: "5678" } });
    });

    test("returns a request without secrets as it is", () => {
        const args = {
            message_id: 123n,
            content: { Text: { text: "hello" } },
            mentioned: [{ user_id: "abc" }],
            pin: undefined,
        };
        expect(redactSecrets(args, "send_message_v2")).toBe(args);
        const list = [args, { other: [1, 2] }];
        expect(redactSecrets(list)).toBe(list);
    });

    test("copies only the objects on the way down to a secret", () => {
        const args = {
            content: { Text: { text: "hello" } },
            mentioned: [{ user_id: "abc" }],
            transfer: { amount: 100n, verification: { pin: "1234" } },
            batch: [{ other: "kept" }, { pin: "5678" }],
        };
        const redacted = redactSecrets(args) as typeof args;
        expect(redacted).not.toBe(args);
        expect(redacted.content).toBe(args.content);
        expect(redacted.mentioned).toBe(args.mentioned);
        expect(redacted.transfer).not.toBe(args.transfer);
        expect(redacted.transfer.verification).toEqual({ pin: REDACTED });
        expect(redacted.batch).not.toBe(args.batch);
        expect(redacted.batch[0]).toBe(args.batch[0]);
        expect(redacted.batch[1]).toEqual({ pin: REDACTED });
    });

    test("redacts PINs nested in objects and arrays", () => {
        const args = {
            accept: { swap: { pin: "1234" } },
            batch: [{ pin: "5678" }, { other: "kept" }],
        };
        expect(redactSecrets(args)).toEqual({
            accept: { swap: { pin: REDACTED } },
            batch: [{ pin: REDACTED }, { other: "kept" }],
        });
    });

    test("redacts both the new and the current PIN of set_pin_number", () => {
        expect(
            redactSecrets({ new: "5678", verification: { PIN: "1234" } }, "set_pin_number"),
        ).toEqual({ new: REDACTED, verification: { PIN: REDACTED } });
    });

    test("redacts the sign-in proof which stands in for the PIN", () => {
        expect(
            redactSecrets(
                { new: "5678", verification: { Reauthenticated: "jwt" } },
                "set_pin_number",
            ),
        ).toEqual({ new: REDACTED, verification: { Reauthenticated: REDACTED } });
        expect(redactSecrets({ chat_id: "abc", sign_in_proof_jwt: "jwt" }, "claim_prize")).toEqual({
            chat_id: "abc",
            sign_in_proof_jwt: REDACTED,
        });
        expect(redactSecrets({ kind: "claimPrize", messageId: 1n, signInProof: "jwt" })).toEqual({
            kind: "claimPrize",
            messageId: 1n,
            signInProof: REDACTED,
        });
    });

    test("only redacts `new` for set_pin_number", () => {
        const args = { new: "fr", previous: "en" };
        expect(redactSecrets(args, "update_primary_language")).toEqual(args);
        expect(redactSecrets(args)).toEqual(args);
    });

    test("redacts the secrets of worker requests", () => {
        expect(
            redactSecrets({
                kind: "setPinNumber",
                newPin: "5678",
                verification: { kind: "pin_verification", pin: "1234" },
                correlationId: 1,
            }),
        ).toEqual({
            kind: "setPinNumber",
            newPin: REDACTED,
            verification: { kind: "pin_verification", pin: REDACTED },
            correlationId: 1,
        });
        expect(
            redactSecrets({
                kind: "setPinNumber",
                newPin: undefined,
                verification: { kind: "reauthenticated", signInProofJwt: "jwt" },
            }),
        ).toEqual({
            kind: "setPinNumber",
            newPin: undefined,
            verification: { kind: "reauthenticated", signInProofJwt: REDACTED },
        });
    });

    test("leaves an absent PIN as it is", () => {
        const args = { pin: undefined, other: { pin: null } };
        expect(redactSecrets(args)).toBe(args);
    });

    test("passes values which are not plain objects through unchanged", () => {
        const bytes = new Uint8Array([1, 2, 3]);
        const principal = Principal.fromText("aaaaa-aa");
        const redacted = redactSecrets({ bytes, principal, amount: 5n, pin: "1234" }) as Record<
            string,
            unknown
        >;
        expect(redacted.bytes).toBe(bytes);
        expect(redacted.principal).toBe(principal);
        expect(redacted.amount).toBe(5n);
        expect(redacted.pin).toBe(REDACTED);

        for (const value of [undefined, null, "1234", 1234, 1234n, true, bytes]) {
            expect(redactSecrets(value)).toBe(value);
        }
    });

    test("cuts cycles without leaking a secret through them", () => {
        const args: Record<string, unknown> = { pin: "1234", child: { other: "kept" } };
        (args.child as Record<string, unknown>).parent = args;
        args.self = args;
        const redacted = redactSecrets(args);
        expect(redacted).toEqual({
            pin: REDACTED,
            child: { other: "kept", parent: CIRCULAR },
            self: CIRCULAR,
        });
        // Throws if a cycle remains
        expect(JSON.stringify(redacted)).not.toMatch(/1234/);
    });

    test("an object referenced twice is not taken for a cycle", () => {
        const shared = { pin: "1234" };
        const plain = { other: "kept" };
        expect(redactSecrets({ a: shared, b: shared, c: [plain, plain] })).toEqual({
            a: { pin: REDACTED },
            b: { pin: REDACTED },
            c: [plain, plain],
        });
    });
});
