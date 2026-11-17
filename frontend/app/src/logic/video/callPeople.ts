import type { DailyParticipant, DailyTrackState } from "@daily-co/daily-js";

// What the new UI's call view shows of a call made with Daily's call object (#10124): who is in
// it, with their video, and which remote audio has to be played. Daily's call object draws
// nothing, so the app plays every remote participant's sound itself (RemoteAudio).

export type CallParticipants = Record<string, DailyParticipant>;

/** How a participant is drawn when their video is off: from the app's users. */
export type CallFace = { name: string; initial: string; grad: string };

/** A person in the call as `CallPanel` takes them (its `CallPerson`). */
export type CallPersonView = CallFace & {
    id: string;
    muted: boolean;
    speaking: boolean;
    stream: MediaStream | null;
};

export type CallSelfView = {
    initial: string;
    grad: string;
    stream: MediaStream | null;
    muted: boolean;
    camera: boolean;
    sharing: boolean;
    screenStream: MediaStream | null;
};

// A track that can be played now, Daily's persistent reference to it (the one Daily recommends
// keeping attached, so a track that is muted and unmuted doesn't need attaching again)
function playable(state: DailyTrackState | undefined): MediaStreamTrack | undefined {
    return state?.state === "playable" ? (state.persistentTrack ?? state.track) : undefined;
}

/**
 * The remote audio to play, keyed by participant and kind: every remote participant's voice, and
 * the sound of a screen they share. Never the user's own, which would echo.
 */
export function remoteAudioTracks(participants: CallParticipants): Map<string, MediaStreamTrack> {
    const tracks = new Map<string, MediaStreamTrack>();
    for (const p of Object.values(participants)) {
        if (p.local) continue;
        const voice = playable(p.tracks.audio);
        if (voice !== undefined) tracks.set(`${p.session_id}:audio`, voice);
        const screen = playable(p.tracks.screenAudio);
        if (screen !== undefined) tracks.set(`${p.session_id}:screenAudio`, screen);
    }
    return tracks;
}

/**
 * The call's people for `CallPanel`: the others, with their video while it plays, muted while
 * their microphone is off and speaking while Daily says they're the active speaker; and the user,
 * with their own camera and shared screen.
 */
export function callPeople(
    participants: CallParticipants,
    activeSpeaker: string | undefined,
    face: (userId: string, userName: string) => CallFace,
    streamOf: (track: MediaStreamTrack) => MediaStream,
): { people: CallPersonView[]; self: CallSelfView | undefined } {
    const stream = (state: DailyTrackState | undefined) => {
        const track = playable(state);
        return track === undefined ? null : streamOf(track);
    };
    const people: CallPersonView[] = [];
    let self: CallSelfView | undefined;
    for (const p of Object.values(participants)) {
        const f = face(p.user_id, p.user_name);
        if (p.local) {
            self = {
                initial: f.initial,
                grad: f.grad,
                stream: stream(p.tracks.video),
                muted: p.tracks.audio.state === "off",
                camera: p.tracks.video.state !== "off",
                sharing: p.tracks.screenVideo.state !== "off",
                screenStream: stream(p.tracks.screenVideo),
            };
        } else {
            people.push({
                ...f,
                id: p.session_id,
                muted: p.tracks.audio.state === "off",
                speaking: p.session_id === activeSpeaker,
                stream: stream(p.tracks.screenVideo) ?? stream(p.tracks.video),
            });
        }
    }
    return { people, self };
}

/** A microphone, speaker or camera the user can pick (`CallPanel`'s `CallDevice`). */
export type CallDevice = { id: string; label: string };

export type CallDevices = {
    mics: CallDevice[];
    speakers: CallDevice[];
    cameras: CallDevice[];
    mic?: string;
    speaker?: string;
    camera?: string;
};

export type CallDeviceKind = "mic" | "speaker" | "camera";

/** The browser's media devices sorted into what the call can use, as they're named. */
export function deviceLists(
    devices: Pick<MediaDeviceInfo, "kind" | "deviceId" | "label">[],
): Pick<CallDevices, "mics" | "speakers" | "cameras"> {
    const of = (kind: MediaDeviceKind) =>
        devices
            .filter((d) => d.kind === kind && d.deviceId !== "")
            .map((d) => ({ id: d.deviceId, label: d.label || d.deviceId.slice(0, 8) }));
    return { mics: of("audioinput"), speakers: of("audiooutput"), cameras: of("videoinput") };
}

/**
 * What the user can send in the call: their microphone and camera, or, a broadcast's viewer
 * without presence, a request to speak (`asked` once made, until the host answers). While joining,
 * Daily hasn't said yet, so the usual controls show.
 */
export type CallSend = "send" | "ask" | "asked";

export function callSend({
    hasPresence,
    joining,
    asked,
}: {
    hasPresence: boolean;
    joining: boolean;
    asked: boolean;
}): CallSend {
    if (hasPresence || joining) return "send";
    return asked ? "asked" : "ask";
}
