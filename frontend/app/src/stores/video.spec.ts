import { get } from "svelte/store";
import { describe, expect, test, vi } from "vitest";

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
