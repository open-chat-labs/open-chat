import { describe, expect, test, vi } from "vitest";

const tauri = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => tauri);

const { reportNativeExits } = await import("./nativeExits");

describe("reporting the Android shell's crashes", () => {
    // Invariant 4: every report the shell hands over goes to the logger (and so through its noise
    // filter to Rollbar), once.
    test("invariant 4 each report goes to the logger once", async () => {
        const anr = { kind: "exit", timestamp: 1, reason: "anr", importance: 100, status: 0 };
        const crash = {
            kind: "uncaught",
            timestamp: 2,
            exceptionClass: "java.lang.IllegalStateException",
            thread: "main",
            stack: "java.lang.IllegalStateException\n\tat com.ocplugin.app.calls.CallRinger.ring(CallRinger.kt:42)\n",
        };
        tauri.invoke.mockResolvedValueOnce({ reports: [anr, crash] });
        const logger = { logError: vi.fn() };

        await reportNativeExits(logger);

        expect(tauri.invoke).toHaveBeenCalledWith("plugin:oc|take_native_exit_reports");
        expect(logger.logError).toHaveBeenCalledTimes(2);
        expect(logger.logError).toHaveBeenCalledWith("Android process exit: anr", anr);
        expect(logger.logError).toHaveBeenCalledWith(
            "Android uncaught java.lang.IllegalStateException at com.ocplugin.app.calls.CallRinger.ring(CallRinger.kt:42)",
            crash,
        );
    });

    // Invariant 5: a shell older than the command (the website updates over the air, the shell
    // doesn't) fails quietly: no rejection, nothing logged.
    test("invariant 5 a shell without the command fails quietly", async () => {
        tauri.invoke.mockRejectedValueOnce("Command take_native_exit_reports not found");
        const logger = { logError: vi.fn() };

        await expect(reportNativeExits(logger)).resolves.toBeUndefined();
        expect(logger.logError).not.toHaveBeenCalled();
    });
});
