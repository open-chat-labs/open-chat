import type { TurnstilePass } from "@client";
import { describe, expect, test, vi } from "vitest";
import { HUMAN_CHECK_WAIT_MS, HumanCheck, isHumanCheckMessage } from "./humanCheck.svelte";

describe("a prize's human check", () => {
    test("a claim takes the token of a check that has passed, and the check runs again", async () => {
        const check = new HumanCheck();
        check.receive({ kind: "turnstile_token", token: "t1", salt: "s1" });

        await expect(check.take()).resolves.toEqual({ token: "t1", salt: "s1" });
        expect(check.run).toBe(1);

        // The token served that claim, so a retry waits for the next one
        let retried: TurnstilePass | undefined;
        void check.take().then((pass) => (retried = pass));
        await Promise.resolve();
        expect(retried).toBeUndefined();
        check.receive({ kind: "turnstile_token", token: "t2", salt: "s2" });
        await Promise.resolve();
        expect(retried).toEqual({ token: "t2", salt: "s2" });
    });

    test("a claim made while the check runs waits for its token", async () => {
        const check = new HumanCheck();
        const claim = check.take();
        check.receive({ kind: "turnstile_token", token: "t1", salt: "s1" });

        await expect(claim).resolves.toEqual({ token: "t1", salt: "s1" });
        expect(check.run).toBe(1);
    });

    test("a check that fails fails the claims waiting for it, and runs again for the next", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const check = new HumanCheck();
        const claim = check.take();
        check.receive({ kind: "turnstile_error", code: "600010" });
        await expect(claim).resolves.toBeUndefined();

        const retry = check.take();
        expect(check.run).toBe(1);
        check.receive({ kind: "turnstile_token", token: "t1", salt: "s1" });
        await expect(retry).resolves.toEqual({ token: "t1", salt: "s1" });
    });

    test("shows the frame while Cloudflare wants the reader to tick its box", () => {
        const check = new HumanCheck();
        expect(check.interactive).toBe(false);
        check.receive({ kind: "turnstile_interactive" });
        expect(check.interactive).toBe(true);
        check.receive({ kind: "turnstile_token", token: "t1", salt: "s1" });
        expect(check.interactive).toBe(false);
    });

    test("an expired token isn't handed to a claim", async () => {
        const check = new HumanCheck();
        check.receive({ kind: "turnstile_token", token: "t1", salt: "s1" });
        check.receive({ kind: "turnstile_expired" });

        const claim = check.take();
        check.receive({ kind: "turnstile_token", token: "t2", salt: "s2" });
        await expect(claim).resolves.toEqual({ token: "t2", salt: "s2" });
    });

    test("a check that says nothing fails the claim after a while, and runs again", async () => {
        vi.useFakeTimers();
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        try {
            const check = new HumanCheck();
            const claim = check.take();
            vi.advanceTimersByTime(HUMAN_CHECK_WAIT_MS);

            await expect(claim).resolves.toBeUndefined();
            expect(check.run).toBe(1);
        } finally {
            vi.useRealTimers();
        }
    });

    test("doesn't give up on a check while the reader is asked to tick its box", async () => {
        vi.useFakeTimers();
        try {
            const check = new HumanCheck();
            let pass: TurnstilePass | undefined;
            void check.take().then((p) => (pass = p));
            check.receive({ kind: "turnstile_interactive" });
            vi.advanceTimersByTime(HUMAN_CHECK_WAIT_MS * 2);
            check.receive({ kind: "turnstile_token", token: "t1", salt: "s1" });
            await vi.runAllTimersAsync();

            expect(pass).toEqual({ token: "t1", salt: "s1" });
        } finally {
            vi.useRealTimers();
        }
    });

    test("reads only the frame's messages", () => {
        expect(isHumanCheckMessage({ kind: "turnstile_token", token: "t", salt: "s" })).toBe(true);
        expect(isHumanCheckMessage({ kind: "turnstile_token", token: "t" })).toBe(false);
        expect(isHumanCheckMessage({ kind: "turnstile_error", code: "600010" })).toBe(true);
        expect(isHumanCheckMessage({ kind: "turnstile_interactive" })).toBe(true);
        expect(isHumanCheckMessage({ kind: "turnstile_token" })).toBe(false);
        expect(isHumanCheckMessage({ kind: "something_else" })).toBe(false);
        expect(isHumanCheckMessage("turnstile_token")).toBe(false);
        expect(isHumanCheckMessage(null)).toBe(false);
    });
});
