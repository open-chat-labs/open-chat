import type { OpenChat } from "@client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { PinNumberForm } from "./pinNumberForm.svelte";

const client = {
    setPinNumber: vi.fn(async () => ({ kind: "success" })),
} as unknown as OpenChat;

const pin = (digits: string) => digits.split("");

describe("a pin number", () => {
    afterEach(() => vi.clearAllMocks());

    // Invariant: without a sign-in proof a pin is never verified with a pin the user didn't
    // enter, so no failed attempt is recorded against them. A forgotten pin reset whose sign-in
    // gave no proof used to send an empty pin.
    test("a reset whose sign-in gave no proof sends nothing and says why", async () => {
        const form = new PinNumberForm(client, { kind: "forgot", while: { kind: "clear" } });

        expect(await form.reauthenticated(undefined)).toBeUndefined();

        expect(client.setPinNumber).not.toHaveBeenCalled();
        expect(form.error?.key).toBe("identity.failure.unexpectedError");
        expect(form.operation.kind).toBe("forgot");

        const clearing = new PinNumberForm(client, { kind: "clear" });
        expect(await clearing.save()).toEqual({ kind: "failed" });
        expect(client.setPinNumber).not.toHaveBeenCalled();
    });

    // Invariant: signing in again stands in for the forgotten pin. Clearing goes straight away;
    // anything else asks only for the new pin.
    test("a sign-in proof replaces the forgotten pin", async () => {
        const clearing = new PinNumberForm(client, { kind: "forgot", while: { kind: "clear" } });
        expect(await clearing.reauthenticated("jwt")).toEqual({
            kind: "saved",
            operation: "clear",
            pin: undefined,
        });
        expect(client.setPinNumber).toHaveBeenLastCalledWith(
            { kind: "reauthenticated", signInProofJwt: "jwt" },
            undefined,
        );

        const entering = new PinNumberForm(client, { kind: "forgot", while: { kind: "enter" } });
        await entering.reauthenticated("jwt");
        expect(entering.operation.kind).toBe("change");
        expect(entering.showCurrentPin).toBe(false);
        expect(entering.valid).toBe(false);
        entering.newPin = pin("123456");
        expect(entering.valid).toBe(true);
        expect(await entering.save()).toEqual({
            kind: "saved",
            operation: "change",
            pin: "123456",
        });
        expect(client.setPinNumber).toHaveBeenLastCalledWith(
            { kind: "reauthenticated", signInProofJwt: "jwt" },
            "123456",
        );
    });

    test("changing a pin sends the current pin with the new one", async () => {
        const form = new PinNumberForm(client, { kind: "change" });
        form.currentPin = pin("111111");
        form.newPin = pin("222222");

        await form.save();

        expect(client.setPinNumber).toHaveBeenCalledWith(
            { kind: "pin_verification", pin: "111111" },
            "222222",
        );
    });
});
