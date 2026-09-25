import { get } from "svelte/store";
import { beforeEach, describe, expect, test, vi } from "vitest";

// Pins the web side of native calls M2 (#9510): invariants 5, 11 and 16.

const tauri = vi.hoisted(() => ({
    invoke: vi.fn(),
    addPluginListener: vi.fn(),
}));
vi.mock("@tauri-apps/api/core", () => tauri);

const nav = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("@utils/navigation", () => nav);

const shared = vi.hoisted(() => ({
    publish: vi.fn(),
    isAndroidTauriApp: vi.fn(() => true),
}));
vi.mock("@shared", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    ...shared,
}));

vi.mock("@daily-co/daily-js", () => {
    throw new Error("@daily-co/daily-js must not be loaded by the call bridge");
});

const accept = {
    kind: "accept",
    chatType: "direct",
    chatId: "alice",
    messageId: "77",
    callType: "audio",
};

describe("native call bridge", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        tauri.addPluginListener.mockResolvedValue({ unregister: () => undefined });
    });

    test("parses an accept and a redial and drops anything else", async () => {
        const { parseCallAction } = await import("./call_bridge");
        expect(parseCallAction(accept)).toEqual({
            kind: "accept",
            chatId: { kind: "direct_chat", userId: "alice" },
            messageId: 77n,
            callType: "audio",
        });
        expect(
            parseCallAction({ kind: "start", chatType: "group", chatId: "g", callType: "video" }),
        ).toEqual({
            kind: "start",
            chatId: { kind: "group_chat", groupId: "g" },
            callType: "default",
        });
        expect(
            parseCallAction({
                kind: "accept",
                chatType: "channel",
                chatId: "5",
                communityId: "c",
                messageId: "1",
            }),
        ).toMatchObject({ chatId: { kind: "channel", communityId: "c", channelId: 5 } });
        expect(
            parseCallAction({ kind: "accept", chatType: "direct", chatId: "alice" }),
        ).toBeUndefined();
        expect(
            parseCallAction({
                kind: "accept",
                chatType: "direct",
                chatId: "alice",
                messageId: "x",
            }),
        ).toBeUndefined();
        expect(
            parseCallAction({
                kind: "decline",
                chatType: "direct",
                chatId: "alice",
                messageId: "1",
            }),
        ).toBeUndefined();
        expect(parseCallAction({ kind: "start", chatType: "dm", chatId: "alice" })).toBeUndefined();
        expect(parseCallAction(null)).toBeUndefined();
        expect(parseCallAction("accept")).toBeUndefined();
    });

    test("invariant 11 a cold-start action is delivered exactly once, after the listener is registered", async () => {
        tauri.invoke.mockResolvedValueOnce({ payload: JSON.stringify(accept) });
        const { expectCallActions, consumePendingCallAction } = await import("./call_bridge");
        const onAction = vi.fn();
        await expectCallActions(onAction);
        expect(tauri.addPluginListener).toHaveBeenCalledWith(
            "oc",
            "call-action",
            expect.any(Function),
        );
        expect(tauri.invoke).toHaveBeenCalledWith("plugin:oc|get_pending_call_action");
        // The warm handler is not used for the cold action: the router drains it.
        expect(onAction).not.toHaveBeenCalled();
        expect(consumePendingCallAction()).toMatchObject({ kind: "accept", messageId: 77n });
        expect(consumePendingCallAction()).toBeNull();
    });

    test("invariant 11 a warm action reaches the handler once as a live event", async () => {
        tauri.invoke.mockResolvedValueOnce({});
        const { expectCallActions, consumePendingCallAction } = await import("./call_bridge");
        const onAction = vi.fn();
        await expectCallActions(onAction);
        const handler = tauri.addPluginListener.mock.calls[0][2] as (raw: unknown) => void;
        handler(accept);
        expect(onAction).toHaveBeenCalledTimes(1);
        expect(onAction.mock.calls[0][0]).toMatchObject({ kind: "accept", messageId: 77n });
        expect(consumePendingCallAction()).toBeNull();
        // Garbage on the event is dropped, not delivered.
        handler({ kind: "accept" });
        expect(onAction).toHaveBeenCalledTimes(1);
    });

    test("invariant 5 in the Android shell the in-app ring never shows, whatever rang it", async () => {
        const { incomingVideoCall } = await import("@stores/video");
        const chatId = { kind: "direct_chat", userId: "alice" } as const;
        incomingVideoCall.set({ chatId, userId: "alice", messageId: 77n, callType: "audio" });
        expect(get(incomingVideoCall)).toBeUndefined();
        // Outside the Android shell the web layer rings as before.
        shared.isAndroidTauriApp.mockReturnValue(false);
        incomingVideoCall.set({ chatId, userId: "alice", messageId: 78n, callType: "audio" });
        expect(get(incomingVideoCall)?.messageId).toBe(78n);
        shared.isAndroidTauriApp.mockReturnValue(true);
    });

    test("running an accept opens the chat and joins", async () => {
        const { runCallAction } = await import("./call_bridge");
        const chatId = { kind: "direct_chat", userId: "alice" } as const;
        runCallAction({ kind: "accept", chatId, messageId: 77n, callType: "audio" });
        expect(nav.navigate).toHaveBeenCalledWith("/chats/user/alice", "notification");
        expect(shared.publish).toHaveBeenCalledWith("startVideoCall", {
            chatId,
            callType: "audio",
            join: true,
        });
    });

    test("a redial starts a call rather than joining one", async () => {
        const { runCallAction } = await import("./call_bridge");
        const chatId = { kind: "group_chat", groupId: "g" } as const;
        runCallAction({ kind: "start", chatId, callType: "default" });
        expect(shared.publish).toHaveBeenCalledWith("startVideoCall", {
            chatId,
            callType: "default",
            join: false,
        });
    });

    test("invariant 16 a shell without native calls is a no-op", async () => {
        tauri.invoke.mockRejectedValue(new Error("plugin:oc|get_pending_call_action not found"));
        const { expectCallActions, consumePendingCallAction, notifyCallJoined } =
            await import("./call_bridge");
        await expect(expectCallActions(vi.fn())).resolves.toBeDefined();
        expect(consumePendingCallAction()).toBeNull();
        // Rejection from the missing command is swallowed, never left unhandled.
        await expect(notifyCallJoined(1n)).resolves.toBeUndefined();
        expect(tauri.invoke).toHaveBeenCalledWith("plugin:oc|call_ring_handled", {
            messageId: "1",
        });
    });

    test("invariant 16 (#9534) the call config is sent only from the Android shell and a shell without it is a no-op", async () => {
        tauri.invoke.mockRejectedValue(new Error("plugin:oc|set_call_config not found"));
        const { setCallConfig } = await import("./call_bridge");
        await expect(setCallConfig("https://bridge")).resolves.toBeUndefined();
        expect(tauri.invoke).toHaveBeenCalledWith("plugin:oc|set_call_config", {
            videoBridgeUrl: "https://bridge",
        });
        tauri.invoke.mockClear();
        shared.isAndroidTauriApp.mockReturnValueOnce(false);
        await setCallConfig("https://bridge");
        expect(tauri.invoke).not.toHaveBeenCalled();
    });

    test("invariant 16 the joined notice is only sent from the Android shell", async () => {
        shared.isAndroidTauriApp.mockReturnValueOnce(false);
        const { notifyCallJoined } = await import("./call_bridge");
        notifyCallJoined(2n);
        expect(tauri.invoke).not.toHaveBeenCalledWith(
            "plugin:oc|call_ring_handled",
            expect.anything(),
        );
    });
});
