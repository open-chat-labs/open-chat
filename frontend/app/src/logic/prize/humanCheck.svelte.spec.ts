import type { TurnstilePass } from "@client";
import { describe, expect, test, vi } from "vitest";
import { HUMAN_CHECK_WAIT_MS, HumanCheck, isHumanCheckMessage } from "./humanCheck.svelte";

describe("a prize's human check", () => {
    test("runs only once a claim asks for it, and gives that claim its token", async () => {
        const check = new HumanCheck();
        expect(check.running).toBe(false);
        expect(check.run).toBe(0);

        const claim = check.take();
        expect(check.running).toBe(true);
        expect(check.run).toBe(1);
        check.receive({ kind: "turnstile_token", token: "t1", salt: "s1" });

        await expect(claim).resolves.toEqual({ token: "t1", salt: "s1" });
        expect(check.running).toBe(false);
    });

    test("runs afresh for each claim", async () => {
        const check = new HumanCheck();
        const first = check.take();
        check.receive({ kind: "turnstile_token", token: "t1", salt: "s1" });
        await first;

        const retry = check.take();
        expect(check.run).toBe(2);
        check.receive({ kind: "turnstile_token", token: "t2", salt: "s2" });
        await expect(retry).resolves.toEqual({ token: "t2", salt: "s2" });
    });

    test("a claim made while the check runs gets a token of its own", async () => {
        const check = new HumanCheck();
        const first = check.take();
        let second: TurnstilePass | undefined;
        void check.take().then((pass) => (second = pass));
        expect(check.run).toBe(1);

        check.receive({ kind: "turnstile_token", token: "t1", salt: "s1" });
        await expect(first).resolves.toEqual({ token: "t1", salt: "s1" });
        expect(second).toBeUndefined();
        expect(check.run).toBe(2);

        check.receive({ kind: "turnstile_token", token: "t2", salt: "s2" });
        await Promise.resolve();
        expect(second).toEqual({ token: "t2", salt: "s2" });
        expect(check.running).toBe(false);
    });

    test("a check that fails fails the claim waiting for it, and runs again for the next", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const check = new HumanCheck();
        const claim = check.take();
        check.receive({ kind: "turnstile_error", code: "600010" });
        await expect(claim).resolves.toBeUndefined();
        expect(check.running).toBe(false);

        const retry = check.take();
        expect(check.run).toBe(2);
        check.receive({ kind: "turnstile_token", token: "t1", salt: "s1" });
        await expect(retry).resolves.toEqual({ token: "t1", salt: "s1" });
    });

    test("shows the frame while Cloudflare wants the reader to tick its box", () => {
        const check = new HumanCheck();
        void check.take();
        expect(check.interactive).toBe(false);
        check.receive({ kind: "turnstile_interactive" });
        expect(check.interactive).toBe(true);
        check.receive({ kind: "turnstile_token", token: "t1", salt: "s1" });
        expect(check.interactive).toBe(false);
    });

    test("a check that says nothing fails the claim after a while", async () => {
        vi.useFakeTimers();
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        try {
            const check = new HumanCheck();
            const claim = check.take();
            vi.advanceTimersByTime(HUMAN_CHECK_WAIT_MS);

            await expect(claim).resolves.toBeUndefined();
            expect(check.running).toBe(false);
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
