import type { DailyCall, DailyParticipant } from "@daily-co/daily-js";
import { addPluginListener, invoke, type PluginListener } from "@tauri-apps/api/core";

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

// `onHangup` is the hang-up button on the native screen
export function createNativeCall(start: NativeCallStart, onHangup: () => void): DailyCall {
    const handlers = new Map<string, Handler[]>();
    let listener: PluginListener | undefined;
    let local: NativeParticipant | undefined;
    let present = 0;

    const emit = (name: string, ev?: unknown) => handlers.get(name)?.forEach((h) => h(ev));
    const leave = () => invoke<void>("plugin:oc|native_call_leave").catch(() => undefined);
    const stopListening = () => {
        listener?.unregister();
        listener = undefined;
    };

    function onEvent(event: NativeCallEvent) {
        switch (event.kind) {
            case "hangup":
                onHangup();
                break;
            case "left":
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
                const joined = parse<{ local: NativeParticipant; present: number }>(
                    await invoke("plugin:oc|native_call_join", start),
                );
                local = joined.local;
                present = joined.present;
                emit("joined-meeting", { participants: { local: toDaily(joined.local) } });
            } catch (e) {
                stopListening();
                throw e;
            }
        },
        leave,
        async destroy() {
            stopListening();
            await leave();
        },
        participants: () => ({ local: local ? toDaily(local) : undefined }),
        participantCounts: () => ({ present, hidden: 0 }),
        // The native screen has its own controls for these
        setLocalAudio: () => call,
        setLocalVideo: () => call,
        setTheme: async () => undefined,
    };
    return call as unknown as DailyCall;
}
