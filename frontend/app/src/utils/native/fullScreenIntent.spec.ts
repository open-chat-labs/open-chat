import { beforeEach, describe, expect, test, vi } from "vitest";

// The first import inside a test counts against its timeout, which a loaded CI runner can pass
vi.setConfig({ testTimeout: 20_000 });

const tauri = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => tauri);

describe("asking for the full-screen ring", () => {
    beforeEach(() => {
        // a fresh module is a fresh app launch
        vi.resetModules();
        tauri.invoke.mockReset();
    });

    test("a missing grant is asked about once per launch", async () => {
        tauri.invoke.mockResolvedValue({ granted: false });
        const { shouldAskForFullScreenIntent } = await import("./fullScreenIntent");
        expect(await shouldAskForFullScreenIntent(true)).toBe(true);
        expect(await shouldAskForFullScreenIntent(true)).toBe(false);
    });

    test("a shell without the command never asks", async () => {
        tauri.invoke.mockRejectedValue(new Error("command not found"));
        const { shouldAskForFullScreenIntent } = await import("./fullScreenIntent");
        expect(await shouldAskForFullScreenIntent(true)).toBe(false);
    });
});
