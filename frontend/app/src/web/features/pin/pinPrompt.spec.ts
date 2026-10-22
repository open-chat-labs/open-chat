import type { PinNumberResolver, RulesAcceptanceResolver } from "@shared";
import { describe, expect, test, vi } from "vitest";
import { PinAnswer, waitingPrompt } from "./pinPrompt";

function pinRequest() {
    const resolve = vi.fn<(pin: string) => void>();
    const reject = vi.fn<() => void>();
    const request: PinNumberResolver = { resolve, reject, message: undefined };
    return { request, resolve, reject };
}

describe("closing the PIN prompt rejects the waiting request; six digits resolve it exactly once", () => {
    test("closing rejects it, so nothing is sent", () => {
        const { request, resolve, reject } = pinRequest();
        new PinAnswer(request).close();
        expect(reject).toHaveBeenCalledTimes(1);
        expect(resolve).not.toHaveBeenCalled();
    });

    test("six digits resolve it once, and nothing after that answers it again", () => {
        const { request, resolve, reject } = pinRequest();
        const answer = new PinAnswer(request);
        expect(answer.enter("123456")).toBe(true);
        expect(answer.enter("123456")).toBe(false);
        answer.close();
        expect(resolve).toHaveBeenCalledTimes(1);
        expect(resolve).toHaveBeenCalledWith("123456");
        expect(reject).not.toHaveBeenCalled();
    });

    test("anything but six digits leaves it waiting", () => {
        const { request, resolve, reject } = pinRequest();
        const answer = new PinAnswer(request);
        expect(answer.enter("12345")).toBe(false);
        expect(answer.enter("12345a")).toBe(false);
        expect(answer.enter("1234567")).toBe(false);
        expect(resolve).not.toHaveBeenCalled();
        expect(reject).not.toHaveBeenCalled();
    });
});

describe("no PIN prompt shows while the rules prompt is waiting", () => {
    const rules: RulesAcceptanceResolver = { resolve: () => undefined };

    test("the rules come first, and the PIN prompt shows once they're answered", () => {
        const { request } = pinRequest();
        expect(waitingPrompt(rules, request)).toEqual({ kind: "rules", request: rules });
        expect(waitingPrompt(undefined, request)).toEqual({ kind: "pin", request });
        expect(waitingPrompt(undefined, undefined)).toEqual({ kind: "none" });
    });
});
