import { callOffer, type VideoCallType } from "@client";
import type { CallPersonView, CallSelfView } from "@src/logic/video/callPeople";
import type { VideoCallView } from "@src/stores/video";
import type { CallOutput, CallOutputRoute } from "@src/utils/native/call_bridge";

// The native call (native design notes §3.5): the chat header's call buttons, how the call screen
// lays out its people and controls, and when the screen or the minimised call shows.

/** A call button in the chat header: what it starts or joins, or back to the user's own call. */
export type HeaderCallButton = {
    icon: "video" | "phone";
    /** An app string key. */
    label: string;
    request: { callType: VideoCallType; join: boolean } | "return";
    /** The call going on here is this kind: the button is green, pulses and joins it. */
    live: boolean;
};

/**
 * The header's call buttons (`callOffer`; native design plan 09, 2026-11-10): video and voice,
 * starting a call in a private chat, or one button starting a broadcast in a public one. While a
 * call the user isn't in is going on, both join it as the type it was started as, and the one of
 * its kind is green; in the user's own call there, both go back to it. The user's own call in the
 * chat counts as the call going on before the chat's summary says so.
 */
export function headerCallButtons({
    canStart,
    isPublic,
    chatCall,
    ownCall,
}: {
    canStart: boolean;
    isPublic: boolean;
    /** The call the chat's summary says is going on. */
    chatCall: VideoCallType | undefined;
    /** The user's own call, when it's in this chat. */
    ownCall: VideoCallType | undefined;
}): HeaderCallButton[] {
    const offer = callOffer({
        canStart,
        isPublic,
        inProgress: chatCall ?? ownCall,
        inCall: ownCall !== undefined,
        canStartBroadcast: true,
    });
    const video = (request: HeaderCallButton["request"], live = false): HeaderCallButton => ({
        icon: "video",
        label: live ? "native.call.joinVideo" : "native.conversation.videoCall",
        request,
        live,
    });
    const voice = (request: HeaderCallButton["request"], live = false): HeaderCallButton => ({
        icon: "phone",
        label: live ? "native.call.joinVoice" : "native.conversation.voiceCall",
        request,
        live,
    });
    switch (offer.kind) {
        case "none":
            return [];
        case "choose":
            return [
                video({ callType: "default", join: false }),
                voice({ callType: "audio", join: false }),
            ];
        case "broadcast":
            return [
                {
                    icon: "video",
                    label: "native.call.startBroadcast",
                    request: { callType: "broadcast", join: false },
                    live: false,
                },
            ];
        case "join": {
            const request = { callType: offer.callType, join: true };
            const voiceCall = offer.callType === "audio";
            return [video(request, !voiceCall), voice(request, voiceCall)];
        }
        case "leave":
            return [
                { ...video("return"), label: "native.call.backToCall" },
                { ...voice("return"), label: "native.call.backToCall" },
            ];
    }
}

/** A person on the call screen's stage. */
export type StageTile = CallPersonView & { self: boolean };

/**
 * The call screen's stage. Video: up to 3 people (the user among them) stack the others in one
 * column with the user's camera as a floating tile; 4 or more are all in a 2-column grid. Voice:
 * everyone as an avatar, the user too.
 */
export function callStage(
    people: CallPersonView[],
    self: CallSelfView | undefined,
    video: boolean,
    you: string,
): { tiles: StageTile[]; floatSelf: boolean; columns: 1 | 2 } {
    const others = people.map((p) => ({ ...p, self: false }));
    const selfTile: StageTile[] =
        self === undefined
            ? []
            : [
                  {
                      id: "self",
                      name: you,
                      initial: self.initial,
                      grad: self.grad,
                      avatarUrl: self.avatarUrl,
                      muted: self.muted,
                      speaking: false,
                      stream: self.stream,
                      self: true,
                  },
              ];
    const total = others.length + selfTile.length;
    const floatSelf = video && self !== undefined && total <= 3;
    if (floatSelf) return { tiles: others, floatSelf, columns: 1 };
    return { tiles: [...others, ...selfTile], floatSelf: false, columns: video ? 2 : 1 };
}

export type CallControlId = "mic" | "camera" | "speaker" | "output" | "ask" | "leave";

/**
 * Where the app can send the call's audio: the route the shell reports (`speaker`), and in a
 * shell that lists them the outputs it can be put on and the one in use (N14).
 */
export type CallAudio = {
    speaker: boolean;
    outputs?: { route: string; outputs: CallOutput[] };
};

const headphones = (route: string) => route === "wired" || route === "bluetooth";

/** A 52px control under the call (design notes §3.5 Controls). `label` is an app string key. */
export type CallControl = {
    id: CallControlId;
    label: string;
    icon: string;
    /** Drawn pressed (white): muted, camera off, the loudspeaker on, asked to speak. */
    on: boolean;
};

/**
 * The call's controls. Video: Mute, Camera, Speaker, Leave; voice: Mute, Speaker, Leave, with no
 * camera (an audio call's room sends audio only). Speaker shows where the app can send the audio
 * (`audio`; undefined where it can't): a toggle between the loudspeaker and the phone, or with
 * headphones connected the output menu, named for the output in use (design notes §3.5). A
 * broadcast viewer who can't send (`speak`) has Ask to speak in place of Mute and Camera.
 */
export function callControls({
    video,
    muted,
    camera,
    audio,
    speak,
}: {
    video: boolean;
    muted: boolean;
    camera: boolean;
    /** Undefined where the app can't send the audio anywhere (a browser, iOS's native screen). */
    audio: CallAudio | undefined;
    speak: "ask" | "asked" | undefined;
}): CallControl[] {
    const controls: CallControl[] = [];
    if (speak !== undefined) {
        controls.push({
            id: "ask",
            label: speak === "asked" ? "native.call.askedToSpeak" : "native.call.askToSpeak",
            icon: "mic",
            on: speak === "asked",
        });
    } else {
        controls.push({
            id: "mic",
            label: muted ? "native.call.unmute" : "native.call.mute",
            icon: muted ? "mic-off" : "mic",
            on: muted,
        });
        if (video) {
            controls.push({
                id: "camera",
                label: camera ? "native.call.cameraOff" : "native.call.cameraOn",
                icon: camera ? "video" : "video-off",
                on: !camera,
            });
        }
    }
    if (audio !== undefined) controls.push(audioControl(audio));
    controls.push({ id: "leave", label: "native.call.leave", icon: "phone-off", on: false });
    return controls;
}

type Call = { view: VideoCallView } | undefined;

/** The call screen shows while there's a call that isn't minimised, where the app draws calls. */
export function callScreenShows(call: Call, drawsCalls: boolean): boolean {
    return drawsCalls && call !== undefined && call.view !== "minimised";
}

/** The minimised call shows exactly while a call is minimised. */
export function miniCallShows(call: Call): boolean {
    return call?.view === "minimised";
}

/**
 * The minimised call's badge: how many people are asking the host to speak, the requests the call
 * screen shows as cards. None waiting, no badge.
 */
export function miniCallRequests(
    call: { accessRequests: readonly unknown[] } | undefined,
): number | undefined {
    return call?.accessRequests.length || undefined;
}

/**
 * The scroll-to-the-latest button shows the call going on (plan 04: green, with a phone badge)
 * exactly while the header's call button does: a call in the chat the user isn't in.
 */
export function latestShowsCall(headerButtons: HeaderCallButton[]): boolean {
    return headerButtons.some((b) => b.live);
}

/**
 * The user's own camera is shown mirrored, as a mirror would, unless it faces away from them (a
 * phone's back camera), where the mirror would turn the world round.
 */
export function mirrorsSelf(stream: MediaStream | null): boolean {
    return stream?.getVideoTracks()[0]?.getSettings().facingMode !== "environment";
}

/** Speaker: the toggle, or with headphones listed, the button that opens the output menu. */
function audioControl({ speaker, outputs }: CallAudio): CallControl {
    if (outputs === undefined || !outputs.outputs.some((o) => headphones(o.route))) {
        return { id: "speaker", label: "native.call.speaker", icon: "volume", on: speaker };
    }
    const route = outputs.route;
    return {
        id: "output",
        label: headphones(route)
            ? "native.call.headphones"
            : route === "speaker"
              ? "native.call.speaker"
              : "native.call.phone",
        icon: headphones(route) ? "headphones" : route === "speaker" ? "volume" : "phone-ear",
        on: route === "speaker",
    };
}

/** A row of the output menu. `label` is an app string key, shown unless there's a `name`. */
export type OutputRow = {
    route: CallOutputRoute;
    label: string;
    name?: string;
    icon: string;
    selected: boolean;
};

/** The output menu: each output the shell lists, the one in use ticked. */
export function outputMenu(outputs: { route: string; outputs: CallOutput[] }): OutputRow[] {
    const labels: Record<CallOutputRoute, [string, string]> = {
        speaker: ["native.call.speaker", "volume"],
        earpiece: ["native.call.phone", "phone-ear"],
        wired: ["native.call.headphones", "headphones"],
        bluetooth: ["native.call.bluetooth", "headphones"],
    };
    return outputs.outputs.map((o) => ({
        route: o.route,
        label: labels[o.route][0],
        ...(o.name !== undefined ? { name: o.name } : {}),
        icon: labels[o.route][1],
        selected: o.route === outputs.route,
    }));
}

/**
 * Picture in picture is asked of the Android app only for a video call the user has joined (N14):
 * a voice call, or one still joining, leaves the app with just its notification.
 */
export function pipArmed(
    call: { status: "joining" | "joined"; callType: string } | undefined,
    androidApp: boolean,
): boolean {
    return androidApp && call?.status === "joined" && call.callType !== "audio";
}
