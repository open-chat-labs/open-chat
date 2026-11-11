import type { DailyCall, DailyParticipant } from "@daily-co/daily-js";
import { addPluginListener, invoke, type PluginListener } from "@tauri-apps/api/core";
import { nativeCallControl } from "./call_bridge";

// iOS calls run in the shell, on the Daily iOS SDK with a native call screen (#10445), because
// WebKit mutes the microphone during a CallKit call. This stands in for the Daily frame, so that
// the call session and the active call store don't care which is running. It covers what those
// two use on iOS, and the rest of the frame's API isn't here.

export type NativeCallStart = {
    url: string;
    token: string;
    userName: string;
    title: string;
    video: boolean;
    cameraOn: boolean;
    micOn: boolean;
    broadcast: boolean;
};

type NativeParticipant = {
    sessionId: string;
    userName: string;
    local: boolean;
    owner: boolean;
    audio: boolean;
    video: boolean;
    hasPresence: boolean;
};

type NativeCallEvent =
    | { kind: "hangup" }
    | { kind: "minimised" }
    | { kind: "route"; speaker: boolean }
    | { kind: "left" }
    | { kind: "error"; message: string }
    | {
          kind: "participant-joined" | "participant-left" | "participant-updated";
          participant: NativeParticipant;
          present: number;
      };

type Handler = (ev: unknown) => void;

function toDaily(p: NativeParticipant): DailyParticipant {
    const track = (on: boolean) => ({ state: on ? "playable" : "off" });
    return {
        session_id: p.sessionId,
        user_name: p.userName,
        local: p.local,
        owner: p.owner,
        permissions: { hasPresence: p.hasPresence },
        tracks: { audio: track(p.audio), video: track(p.video), screenVideo: track(false) },
    } as unknown as DailyParticipant;
}

function parse<T>(raw: unknown): T {
    return JSON.parse((raw as { json: string }).json) as T;
}

// What the native screen asks of the web layer
export type NativeCallHooks = {
    // the hang-up button
    onHangup: () => void;
    // the screen was minimised back to the chat
    onMinimise: () => void;
    // the audio route changed, from the screen or the system call controls
    onRoute: (speaker: boolean) => void;
};

export function createNativeCall(start: NativeCallStart, hooks: NativeCallHooks): DailyCall {
    const handlers = new Map<string, Handler[]>();
    let listener: PluginListener | undefined;
    let local: NativeParticipant | undefined;
    let present = 0;
    let finished = false;
    // The shell holds a join until the call it replaces has left (End & Accept), so events before
    // this call has joined belong to that one
    let joined = false;

    const emit = (name: string, ev?: unknown) => handlers.get(name)?.forEach((h) => h(ev));
    const leave = () => invoke<void>("plugin:oc|native_call_leave").catch(() => undefined);
    const stopListening = () => {
        listener?.unregister();
        listener = undefined;
    };

    function onEvent(event: NativeCallEvent) {
        if (!joined) return;
        switch (event.kind) {
            case "hangup":
                hooks.onHangup();
                break;
            case "minimised":
                hooks.onMinimise();
                break;
            case "route":
                hooks.onRoute(event.speaker);
                break;
            case "left":
                // The shell holds one call at a time, so anything said after this concerns the next
                finished = true;
                stopListening();
                emit("left-meeting");
                break;
            case "error":
                emit("error", { errorMsg: event.message });
                break;
            default:
                present = event.present;
                if (event.participant.local) local = event.participant;
                emit(event.kind, { participant: toDaily(event.participant) });
        }
    }

    const call = {
        on(name: string, handler: Handler) {
            handlers.set(name, [...(handlers.get(name) ?? []), handler]);
            return call;
        },
        async join() {
            listener = await addPluginListener("oc", "native-call-event", (raw: unknown) =>
                onEvent(parse<NativeCallEvent>(raw)),
            );
            try {
                const state = parse<{ local: NativeParticipant; present: number }>(
                    await invoke("plugin:oc|native_call_join", start),
                );
                local = state.local;
                present = state.present;
                joined = true;
                emit("joined-meeting", { participants: { local: toDaily(state.local) } });
                // the state the frame's first update would give, such as having presence
                emit("participant-updated", { participant: toDaily(state.local) });
            } catch (e) {
                stopListening();
                throw e;
            }
        },
        leave,
        // #10398 invariant 25: a finished call must not end the one that replaced it
        async destroy() {
            stopListening();
            if (!finished) await leave();
        },
        participants: () => ({ local: local ? toDaily(local) : undefined }),
        participantCounts: () => ({ present, hidden: 0 }),
        // For the minimised call's strip. The native call reports the change back as a participant update.
        localAudio: () => local?.audio ?? false,
        localVideo: () => local?.video ?? false,
        setLocalAudio: (on: boolean) => {
            void nativeCallControl({ kind: "mic", on });
            return call;
        },
        setLocalVideo: (on: boolean) => {
            void nativeCallControl({ kind: "camera", on });
            return call;
        },
        setTheme: async () => undefined,
    };
    return call as unknown as DailyCall;
}
