import { describe, expect, test, vi } from "vitest";
import { startUpSucceeded } from "./startUp";

describe("startUpSucceeded", () => {
    test("a loaded identity, or a sign-out, is a start-up that worked", async () => {
        const log = vi.fn();
        expect(await startUpSucceeded(async () => "loaded", log)).toBe(true);
        expect(await startUpSucceeded(async () => "signed_out", log)).toBe(true);
        expect(log).not.toHaveBeenCalled();
    });

    test("a user that couldn't be loaded fails it", async () => {
        expect(await startUpSucceeded(async () => "user_load_failed", vi.fn())).toBe(false);
    });

    test("a rejected identity set-up fails it, logged, rather than left unhandled", async () => {
        const log = vi.fn();
        const err = new Error("connection refused");
        expect(
            await startUpSucceeded(async () => {
                throw err;
            }, log),
        ).toBe(false);
        expect(log).toHaveBeenCalledWith(err);
    });
});
