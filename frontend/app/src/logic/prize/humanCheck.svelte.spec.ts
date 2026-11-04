import { describe, expect, test, vi } from "vitest";
import { HumanCheck, isHumanCheckMessage } from "./humanCheck.svelte";

describe("a prize's human check", () => {
    test("a claim takes the token of a check that has passed, and the check runs again", async () => {
        const check = new HumanCheck();
        check.receive({ kind: "turnstile_token", token: "t1" });

        await expect(check.take()).resolves.toBe("t1");
        expect(check.run).toBe(1);

        // The token served that claim, so a retry waits for the next one
        let retried: string | undefined;
        void check.take().then((token) => (retried = token));
        await Promise.resolve();
        expect(retried).toBeUndefined();
        check.receive({ kind: "turnstile_token", token: "t2" });
        await Promise.resolve();
        expect(retried).toBe("t2");
    });

    test("a claim made while the check runs waits for its token", async () => {
        const check = new HumanCheck();
        const claim = check.take();
        check.receive({ kind: "turnstile_token", token: "t1" });

        await expect(claim).resolves.toBe("t1");
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
        check.receive({ kind: "turnstile_token", token: "t1" });
        await expect(retry).resolves.toBe("t1");
    });

    test("shows the frame while Cloudflare wants the reader to tick its box", () => {
        const check = new HumanCheck();
        expect(check.interactive).toBe(false);
        check.receive({ kind: "turnstile_interactive" });
        expect(check.interactive).toBe(true);
        check.receive({ kind: "turnstile_token", token: "t1" });
        expect(check.interactive).toBe(false);
    });

    test("an expired token isn't handed to a claim", async () => {
        const check = new HumanCheck();
        check.receive({ kind: "turnstile_token", token: "t1" });
        check.receive({ kind: "turnstile_expired" });

        const claim = check.take();
        check.receive({ kind: "turnstile_token", token: "t2" });
        await expect(claim).resolves.toBe("t2");
    });

    test("reads only the frame's messages", () => {
        expect(isHumanCheckMessage({ kind: "turnstile_token", token: "t" })).toBe(true);
        expect(isHumanCheckMessage({ kind: "turnstile_error", code: "600010" })).toBe(true);
        expect(isHumanCheckMessage({ kind: "turnstile_interactive" })).toBe(true);
        expect(isHumanCheckMessage({ kind: "turnstile_token" })).toBe(false);
        expect(isHumanCheckMessage({ kind: "something_else" })).toBe(false);
        expect(isHumanCheckMessage("turnstile_token")).toBe(false);
        expect(isHumanCheckMessage(null)).toBe(false);
    });
});
