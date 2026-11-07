import { describe, expect, test, vi } from "vitest";
import { notificationSwitch, setNotifications } from "./notifications";

function controls(ask: () => Promise<unknown> = async () => "granted") {
    return { ask: vi.fn(ask), softDisable: vi.fn() };
}

describe("the notifications switch", () => {
    test("is on only once the browser allows them", () => {
        expect(notificationSwitch("granted")).toEqual({ kind: "switch", on: true });
        expect(notificationSwitch("prompt")).toEqual({ kind: "switch", on: false });
        expect(notificationSwitch("soft-denied")).toEqual({ kind: "switch", on: false });
        expect(notificationSwitch("pending-init")).toEqual({ kind: "switch", on: false });
    });

    test("isn't offered where there's no web push, nor while the browser blocks them", () => {
        expect(notificationSwitch("unsupported")).toEqual({ kind: "unsupported" });
        expect(notificationSwitch("hard-denied")).toEqual({ kind: "blocked" });
    });

    test("turned on, asks the browser", async () => {
        const c = controls();
        await setNotifications(true, "soft-denied", c);
        expect(c.ask).toHaveBeenCalled();
        expect(c.softDisable).not.toHaveBeenCalled();
    });

    test("turned off, only stops offering them", async () => {
        const c = controls();
        await setNotifications(false, "granted", c);
        expect(c.softDisable).toHaveBeenCalledWith(true);
        expect(c.ask).not.toHaveBeenCalled();
    });

    test("doesn't ask where there are none, and a failed ask is no failure", async () => {
        const c = controls();
        await setNotifications(true, "unsupported", c);
        expect(c.ask).not.toHaveBeenCalled();
        const failing = controls(async () => {
            throw new Error("no");
        });
        await expect(setNotifications(true, "prompt", failing)).resolves.toBeUndefined();
    });
});
