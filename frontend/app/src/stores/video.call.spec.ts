import { get } from "svelte/store";
import { beforeEach, describe, expect, test, vi } from "vitest";

// These tests import the module under test inside each test, so the first import's transform time
// counts against the timeout. Under a loaded CI runner that can pass the 5s default.
vi.setConfig({ testTimeout: 20_000 });

const bridge = {
    reportCallActive: vi.fn(async () => undefined),
    reportCallEnded: vi.fn(async () => undefined),
    keepCallTeardownTokenFresh: vi.fn(() => stopRefresh),
};
const stopRefresh = vi.fn();
vi.mock("../utils/native/call_bridge", () => bridge);
const platform = vi.hoisted(() => ({ android: true, ios: false }));
vi.mock("@shared", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    isAndroidTauriApp: () => platform.android,
    isIosTauriApp: () => platform.ios,
}));

// #9559 invariants 2 and 7, the store half: what the active call reports to the shell and
// what it does with the shell's controls.

function fakeCall() {
    return {
        participants: () => ({ local: { session_id: "sess-1" } }),
        leave: vi.fn(),
        setLocalAudio: vi.fn(),
        destroy: vi.fn(),
    };
}

const direct = { kind: "direct_chat", userId: "u" } as const;

describe("the active call and the shell (#9559)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("invariant 2 an active call is reported with its kind and its refresh starts; an ended call is reported and the refresh stops", async () => {
        const { activeVideoCall } = await import("./video");
        const call = fakeCall();
        const fetchToken = vi.fn(async () => "t");
        activeVideoCall.joining(direct, "audio");
        activeVideoCall.setCall(direct, 7n, call as never, "Alice", fetchToken);
        expect(bridge.reportCallActive).toHaveBeenCalledWith(direct, 7n, false, "Alice");
        expect(bridge.keepCallTeardownTokenFresh).toHaveBeenCalledWith(
            direct,
            7n,
            fetchToken,
            "sess-1",
        );
        activeVideoCall.endCall();
        expect(stopRefresh).toHaveBeenCalled();
        expect(bridge.reportCallEnded).toHaveBeenCalledWith(direct, 7n);
        expect(call.destroy).toHaveBeenCalled();
        expect(get(activeVideoCall)).toBeUndefined();
    });

    test("invariant 7 a native control is applied to the active call by message id, and mute keeps its polarity", async () => {
        const { activeVideoCall, speaker } = await import("./video");
        const call = fakeCall();
        activeVideoCall.joining(direct, "audio");
        activeVideoCall.setCall(direct, 7n, call as never, "Alice");
        // another call's control changes nothing
        activeVideoCall.applyNativeControl({ kind: "hangup", messageId: 8n });
        expect(call.leave).not.toHaveBeenCalled();
        activeVideoCall.applyNativeControl({ kind: "mute", messageId: 7n, muted: true });
        expect(call.setLocalAudio).toHaveBeenLastCalledWith(false);
        activeVideoCall.applyNativeControl({ kind: "mute", messageId: 7n, muted: false });
        expect(call.setLocalAudio).toHaveBeenLastCalledWith(true);
        activeVideoCall.applyNativeControl({ kind: "route", messageId: 7n, speaker: true });
        expect(get(speaker)).toBe(true);
        activeVideoCall.applyNativeControl({ kind: "hangup", messageId: 7n });
        expect(call.leave).toHaveBeenCalledTimes(1);
        activeVideoCall.endCall();
    });

    test("invariant 16 (#10398) the iOS shell never shows the in-app ring sheet", async () => {
        const { incomingVideoCall } = await import("./video");
        const { get } = await import("svelte/store");
        const ring = (messageId: bigint) => ({
            chatId: direct,
            userId: "u",
            messageId,
            callType: "default" as const,
        });

        platform.android = false;
        platform.ios = true;
        incomingVideoCall.set(ring(1n));
        expect(get(incomingVideoCall)).toBeUndefined();

        platform.ios = false;
        incomingVideoCall.set(ring(2n));
        expect(get(incomingVideoCall)?.messageId).toBe(2n);

        incomingVideoCall.set(undefined);
        platform.android = true;
    });
});
