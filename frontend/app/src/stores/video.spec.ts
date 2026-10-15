import { get } from "svelte/store";
import { describe, expect, test, vi } from "vitest";

// These tests import the module under test inside each test, so the first import's transform time
// counts against the timeout. Under a loaded CI runner that can pass the 5s default.
vi.setConfig({ testTimeout: 20_000 });

vi.mock("@daily-co/daily-js", () => {
    throw new Error("@daily-co/daily-js must not be loaded when stores/video is imported");
});

describe("stores/video", () => {
    test("importing the store does not load @daily-co/daily-js", async () => {
        await expect(import("./video")).resolves.toBeDefined();
    });

    test("incomingVideoCall ignores a second ring for the same messageId", async () => {
        const { incomingVideoCall } = await import("./video");
        const chatId = { kind: "direct_chat", userId: "u1" } as const;
        incomingVideoCall.set({ chatId, userId: "u1", messageId: 1n, callType: "default" });
        expect(get(incomingVideoCall)?.messageId).toBe(1n);
        incomingVideoCall.set(undefined);
        incomingVideoCall.set({ chatId, userId: "u1", messageId: 1n, callType: "default" });
        expect(get(incomingVideoCall)).toBeUndefined();
        incomingVideoCall.set({ chatId, userId: "u1", messageId: 2n, callType: "default" });
        expect(get(incomingVideoCall)?.messageId).toBe(2n);
    });

    // Invariant: a call started elsewhere rings, unless the user is already in it, has been in
    // it, or it started more than two hours ago
    test("a call rings unless the user is in it, has been in it, or it is old", async () => {
        const { activeVideoCall, incomingVideoCall, ringForRemoteCall } = await import("./video");
        const chatId = { kind: "group_chat", groupId: "g1" } as const;
        const now = 10 * 60 * 60 * 1000;
        const call = (messageId: bigint) => ({
            chatId,
            userId: "u1",
            messageId,
            callType: "default" as const,
            currentUserIsParticipant: false,
            timestamp: BigInt(now),
        });
        incomingVideoCall.set(undefined);

        ringForRemoteCall({ ...call(10n), currentUserIsParticipant: true }, now);
        ringForRemoteCall({ ...call(11n), timestamp: BigInt(now - 2 * 60 * 60 * 1000 - 1) }, now);
        activeVideoCall.joining(chatId, "default");
        ringForRemoteCall(call(12n), now);
        activeVideoCall.endCall();
        expect(get(incomingVideoCall)).toBeUndefined();

        ringForRemoteCall(call(13n), now);
        expect(get(incomingVideoCall)?.messageId).toBe(13n);
        incomingVideoCall.set(undefined);
    });

    test("joining / setView / endCall lifecycle", async () => {
        const { activeVideoCall, microphone, camera } = await import("./video");
        const chatId = { kind: "direct_chat", userId: "u1" } as const;
        activeVideoCall.joining(chatId, "default");
        expect(get(activeVideoCall)).toMatchObject({
            status: "joining",
            chatId,
            view: "default",
            accessRequests: [],
            isOwner: false,
        });
        activeVideoCall.setView("minimised");
        expect(get(activeVideoCall)?.view).toBe("minimised");
        microphone.set(true);
        camera.set(true);
        activeVideoCall.endCall();
        expect(get(activeVideoCall)).toBeUndefined();
        expect(get(microphone)).toBe(false);
        expect(get(camera)).toBe(false);
    });
});
