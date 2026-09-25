import { addPluginListener, invoke, type PluginListener } from "@tauri-apps/api/core";
import {
    isAndroidTauriApp,
    publish,
    routeForChatIdentifier,
    type ChatIdentifier,
    type VideoCallType,
} from "@shared";
import { navigate } from "@utils/navigation";

// The only file that knows the native call event and command names.
//
// The Android shell rings for a call push natively (native calls M2, #9510). When the
// user answers, or redials from the phone's call log, the shell hands the web layer one
// action: warm as a "call-action" event, cold parked in the shell and drained here once
// the listener exists, the same way a notification tap is. Every command is wrapped so a
// shell without it is a no-op and the website behaves as before.

const TAURI_PLUGIN_NAME = "oc";
const CALL_ACTION_EVENT = "call-action";
const CALL_CONTROL_EVENT = "call-control";

export type NativeCallAction =
    | { kind: "accept"; chatId: ChatIdentifier; messageId: bigint; callType: VideoCallType }
    | { kind: "start"; chatId: ChatIdentifier; callType: VideoCallType };

type RawCallAction = {
    kind?: string;
    chatType?: string;
    chatId?: string;
    communityId?: string;
    messageId?: string;
    callType?: string;
};

// Pure. Anything malformed is dropped rather than guessed at.
export function parseCallAction(raw: unknown): NativeCallAction | undefined {
    if (typeof raw !== "object" || raw === null) return undefined;
    const r = raw as RawCallAction;
    const chatId = chatIdentifier(r);
    if (chatId === undefined) return undefined;
    const callType = videoCallType(r.callType);
    if (r.kind === "accept") {
        if (r.messageId === undefined || !/^\d+$/.test(r.messageId)) return undefined;
        return { kind: "accept", chatId, messageId: BigInt(r.messageId), callType };
    }
    if (r.kind === "start") {
        return { kind: "start", chatId, callType };
    }
    return undefined;
}

function chatIdentifier(r: RawCallAction): ChatIdentifier | undefined {
    if (r.chatId === undefined) return undefined;
    switch (r.chatType) {
        case "direct":
            return { kind: "direct_chat", userId: r.chatId };
        case "group":
            return { kind: "group_chat", groupId: r.chatId };
        case "channel":
            if (r.communityId === undefined || !/^\d+$/.test(r.chatId)) return undefined;
            return { kind: "channel", communityId: r.communityId, channelId: Number(r.chatId) };
        default:
            return undefined;
    }
}

function videoCallType(kind: string | undefined): VideoCallType {
    switch (kind) {
        case "audio":
            return "audio";
        case "broadcast":
            return "broadcast";
        default:
            return "default";
    }
}

// Set by the cold-start drain, consumed once by Router.svelte's auto-selection effect.
let pendingColdStartAction: NativeCallAction | null = null;

export function consumePendingCallAction(): NativeCallAction | null {
    const action = pendingColdStartAction;
    pendingColdStartAction = null;
    return action;
}

// Registers the warm listener, then drains the action the shell parked while the WebView
// was starting. Resolves to undefined on a shell without native calls.
export async function expectCallActions(
    onAction: (action: NativeCallAction) => void,
): Promise<PluginListener | undefined> {
    let listener: PluginListener | undefined;
    try {
        listener = await addPluginListener(TAURI_PLUGIN_NAME, CALL_ACTION_EVENT, (raw: unknown) => {
            const action = parseCallAction(raw);
            if (action) onAction(action);
        });
    } catch (e) {
        console.error("Call action: listener registration failed", e);
    }

    let pending: { payload?: string } | undefined;
    try {
        pending = await invoke<{ payload?: string }>("plugin:oc|get_pending_call_action");
    } catch {
        // Older shell without native calls.
        return listener;
    }
    if (pending?.payload) {
        try {
            const action = parseCallAction(JSON.parse(pending.payload));
            if (action) pendingColdStartAction = action;
        } catch (e) {
            console.error("Call action: failed to parse pending payload", pending.payload, e);
        }
    }
    return listener;
}

// Opens the chat and joins or starts the call.
export function runCallAction(action: NativeCallAction): void {
    navigate(routeForChatIdentifier("none", action.chatId), "notification");
    publish("startVideoCall", {
        chatId: action.chatId,
        callType: action.callType,
        join: action.kind === "accept",
    });
}

// What the shell needs to act on a call with the app not running: the bridge to tell
// when the user declines from the ring. Sent on every start so a changed URL is picked
// up. Never rejects: a shell without the command is a no-op.
export function setCallConfig(videoBridgeUrl: string): Promise<void> {
    if (!isAndroidTauriApp()) return Promise.resolve();
    return invoke<void>("plugin:oc|set_call_config", { videoBridgeUrl }).catch(() => undefined);
}

// In-call (#9559). The shell needs to know when a call is active so it can keep the
// process alive, own the audio route and show the ongoing-call notification, and when
// it ended so it can let go. Both are no-ops in a shell without them.
export function reportCallActive(
    chatId: ChatIdentifier,
    messageId: bigint,
    video: boolean,
    title: string,
): Promise<void> {
    if (!isAndroidTauriApp()) return Promise.resolve();
    return invoke<void>("plugin:oc|call_active", {
        ...chatArgs(chatId),
        messageId: messageId.toString(),
        video,
        title,
    }).catch(() => undefined);
}

export function reportCallEnded(chatId: ChatIdentifier, messageId: bigint): Promise<void> {
    if (!isAndroidTauriApp()) return Promise.resolve();
    return invoke<void>("plugin:oc|call_ended", {
        ...chatArgs(chatId),
        messageId: messageId.toString(),
    }).catch(() => undefined);
}

function chatArgs(chatId: ChatIdentifier): {
    chatType: string;
    chatId: string;
    communityId?: string;
} {
    switch (chatId.kind) {
        case "direct_chat":
            return { chatType: "direct", chatId: chatId.userId };
        case "group_chat":
            return { chatType: "group", chatId: chatId.groupId };
        case "channel":
            return {
                chatType: "channel",
                chatId: chatId.channelId.toString(),
                communityId: chatId.communityId,
            };
    }
}

// What the shell does with the token when the app is killed mid-call: a direct call is
// ended for both sides; a group or channel call is only left, since ending a room ends
// it for everyone.
export function teardownKind(chatId: ChatIdentifier): "end" | "leave" {
    return chatId.kind === "direct_chat" ? "end" : "leave";
}

// The bridge token for the shell's native teardown of the active call.
export function setCallTeardownToken(
    chatId: ChatIdentifier,
    messageId: bigint,
    token: string,
): Promise<void> {
    if (!isAndroidTauriApp()) return Promise.resolve();
    return invoke<void>("plugin:oc|set_call_end_token", {
        ...chatArgs(chatId),
        messageId: messageId.toString(),
        token,
        kind: teardownKind(chatId),
    }).catch(() => undefined);
}

// Keeps the shell's teardown token fresh for the life of a call: tokens last five
// minutes. Returns the stop function.
export function keepCallTeardownTokenFresh(
    chatId: ChatIdentifier,
    messageId: bigint,
    fetchToken: () => Promise<string>,
    intervalMs = TEARDOWN_TOKEN_REFRESH_MS,
): () => void {
    if (!isAndroidTauriApp()) return () => undefined;
    const refresh = () =>
        fetchToken()
            .then((token) => setCallTeardownToken(chatId, messageId, token))
            .catch((e) => console.warn("Call teardown token refresh failed", e));
    refresh();
    const timer = window.setInterval(refresh, intervalMs);
    return () => window.clearInterval(timer);
}

export const TEARDOWN_TOKEN_REFRESH_MS = 4 * 60 * 1000;

// The caller's ringback while a direct call they started rings out (#9559).
export function setCallRingback(on: boolean): Promise<void> {
    if (!isAndroidTauriApp()) return Promise.resolve();
    return invoke<void>("plugin:oc|set_call_ringback", { on }).catch(() => undefined);
}

// The in-app speaker control. Telecom owns the route in the shell; this is a request.
export function setCallSpeaker(speaker: boolean): Promise<void> {
    if (!isAndroidTauriApp()) return Promise.resolve();
    return invoke<void>("plugin:oc|set_call_speaker", { speaker }).catch(() => undefined);
}

// What a native surface (the ongoing notification, a headset, Telecom) did to the call.
export type NativeCallControl =
    | { kind: "hangup"; messageId: bigint }
    | { kind: "mute"; messageId: bigint; muted: boolean }
    | { kind: "route"; messageId: bigint; speaker: boolean };

type RawCallControl = { kind?: string; messageId?: string; muted?: boolean; speaker?: boolean };

// Pure. Anything malformed is dropped rather than guessed at.
export function parseCallControl(raw: unknown): NativeCallControl | undefined {
    if (typeof raw !== "object" || raw === null) return undefined;
    const r = raw as RawCallControl;
    if (r.messageId === undefined || !/^\d+$/.test(r.messageId)) return undefined;
    const messageId = BigInt(r.messageId);
    switch (r.kind) {
        case "hangup":
            return { kind: "hangup", messageId };
        case "mute":
            return typeof r.muted === "boolean"
                ? { kind: "mute", messageId, muted: r.muted }
                : undefined;
        case "route":
            return typeof r.speaker === "boolean"
                ? { kind: "route", messageId, speaker: r.speaker }
                : undefined;
        default:
            return undefined;
    }
}

export async function expectCallControls(
    onControl: (control: NativeCallControl) => void,
): Promise<PluginListener | undefined> {
    if (!isAndroidTauriApp()) return undefined;
    try {
        return await addPluginListener(TAURI_PLUGIN_NAME, CALL_CONTROL_EVENT, (raw: unknown) => {
            const control = parseCallControl(raw);
            if (control) onControl(control);
        });
    } catch (e) {
        console.error("Call control: listener registration failed", e);
        return undefined;
    }
}

// The web layer joined this call from inside the app (the call message's Join button)
// while the shell may still be ringing for it: the shell ends its ring as answered
// here. Never rejects: a shell without the command is a no-op.
export function notifyCallJoined(messageId: bigint): Promise<void> {
    if (!isAndroidTauriApp()) return Promise.resolve();
    return invoke<void>("plugin:oc|call_ring_handled", { messageId: messageId.toString() }).catch(
        () => undefined,
    );
}
