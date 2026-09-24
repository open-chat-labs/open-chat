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

// The web layer joined this call from inside the app (the call message's Join button)
// while the shell may still be ringing for it: the shell ends its ring as answered
// here. Never rejects: a shell without the command is a no-op.
export function notifyCallJoined(messageId: bigint): Promise<void> {
    if (!isAndroidTauriApp()) return Promise.resolve();
    return invoke<void>("plugin:oc|call_ring_handled", { messageId: messageId.toString() }).catch(
        () => undefined,
    );
}
