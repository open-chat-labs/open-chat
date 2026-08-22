import { Principal } from "@icp-sdk/core/principal";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenChatConfig } from "../config";

const usergeek = vi.hoisted(() => ({
    init: vi.fn(),
    setPrincipal: vi.fn(),
    trackSession: vi.fn(),
    trackEvent: vi.fn(),
}));

vi.mock("usergeek-ic-js", () => ({ Usergeek: usergeek }));

const config = { icUrl: "https://ic0.app", userGeekApiKey: "key" } as OpenChatConfig;
const principal = "2vxsx-fae";

async function load(nodeEnv: string) {
    vi.resetModules();
    vi.stubEnv("OC_NODE_ENV", nodeEnv);
    return await import("./tracking");
}

async function flush() {
    vi.runAllTimers();
    await vi.runAllTimersAsync();
}

describe("tracking", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.stubGlobal("requestIdleCallback", undefined);
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it("does nothing outside production", async () => {
        const t = await load("development");
        t.initialiseTracking(config);
        t.startTrackingSession(principal);
        t.trackEvent("x");
        t.endTrackingSession();
        await flush();
        expect(usergeek.init).not.toHaveBeenCalled();
        expect(usergeek.setPrincipal).not.toHaveBeenCalled();
        expect(usergeek.trackSession).not.toHaveBeenCalled();
        expect(usergeek.trackEvent).not.toHaveBeenCalled();
    });

    it("passes a timeout to requestIdleCallback", async () => {
        const ric = vi.fn((fn: () => void) => fn());
        vi.stubGlobal("requestIdleCallback", ric);
        const t = await load("production");
        t.initialiseTracking(config);
        await flush();
        expect(ric).toHaveBeenCalledWith(expect.any(Function), { timeout: 3000 });
        expect(usergeek.init).toHaveBeenCalledTimes(1);
    });

    it("initialises usergeek with apiKey and host in production", async () => {
        const t = await load("production");
        t.initialiseTracking(config);
        await flush();
        expect(usergeek.init).toHaveBeenCalledTimes(1);
        expect(usergeek.init).toHaveBeenCalledWith({ apiKey: "key", host: "https://ic0.app" });
    });

    it("starts a session, tracks events and ends the session after init", async () => {
        const t = await load("production");
        t.initialiseTracking(config);
        t.startTrackingSession(principal);
        t.trackEvent("evt");
        t.endTrackingSession();
        await flush();
        const order = [
            usergeek.init.mock.invocationCallOrder[0],
            usergeek.setPrincipal.mock.invocationCallOrder[0],
            usergeek.trackSession.mock.invocationCallOrder[0],
            usergeek.trackEvent.mock.invocationCallOrder[0],
            usergeek.setPrincipal.mock.invocationCallOrder[1],
        ];
        expect([...order].sort((a, b) => a - b)).toEqual(order);
        expect(usergeek.setPrincipal).toHaveBeenNthCalledWith(1, Principal.fromText(principal));
        expect(usergeek.trackSession).toHaveBeenCalledTimes(1);
        expect(usergeek.trackEvent).toHaveBeenCalledWith("evt");
        expect(usergeek.setPrincipal).toHaveBeenNthCalledWith(2, undefined);
    });

    it("swallows a failed usergeek load and keeps later calls inert", async () => {
        vi.resetModules();
        vi.doMock("usergeek-ic-js", () => {
            throw new Error("chunk failed");
        });
        vi.stubEnv("OC_NODE_ENV", "production");
        const t = await import("./tracking");
        t.initialiseTracking(config);
        t.startTrackingSession(principal);
        t.trackEvent("evt");
        await flush();
        expect(usergeek.init).not.toHaveBeenCalled();
        expect(usergeek.trackEvent).not.toHaveBeenCalled();
        vi.doMock("usergeek-ic-js", () => ({ Usergeek: usergeek }));
    });
});
