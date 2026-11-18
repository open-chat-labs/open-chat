import type { DailyCall, DailyEvent } from "@daily-co/daily-js";
import {
    deviceLists,
    remoteAudioTracks,
    type CallDeviceKind,
    type CallDevices,
    type CallParticipants,
} from "./callPeople";
import { RemoteAudio } from "./remoteAudio";

// The events after which who is in the call, or what they send, may have changed
const CHANGES: DailyEvent[] = [
    "joined-meeting",
    "participant-joined",
    "participant-updated",
    "participant-left",
    "track-started",
    "track-stopped",
];

/**
 * The media of a call made with Daily's call object, for the new UI's call view: its participants
 * as Daily reports them, the active speaker, and its remote audio playing for as long as the call
 * is attached.
 */
export class CallMedia {
    participants = $state.raw<CallParticipants>({});
    activeSpeaker = $state<string>();
    // the microphones, speakers and cameras to choose from, and the ones in use
    devices = $state.raw<CallDevices>({ mics: [], speakers: [], cameras: [] });

    #call: DailyCall | undefined;
    #audio: RemoteAudio;
    #streams = new WeakMap<MediaStreamTrack, MediaStream>();
    #handlers: [DailyEvent, () => void][] = [];

    constructor(audio: RemoteAudio = new RemoteAudio()) {
        this.#audio = audio;
    }

    /**
     * One stream per track, so a video element keeps its stream while the participants update
     * around it rather than being given a new one, and flickering, on every change.
     */
    streamOf = (track: MediaStreamTrack): MediaStream => {
        let stream = this.#streams.get(track);
        if (stream === undefined) {
            stream = new MediaStream([track]);
            this.#streams.set(track, stream);
        }
        return stream;
    };

    attach(call: DailyCall): void {
        this.detach();
        this.#call = call;
        const refresh = () => this.#refresh();
        const speaker = (ev?: { activeSpeaker?: { peerId: string } }) => {
            this.activeSpeaker = ev?.activeSpeaker?.peerId;
        };
        for (const event of CHANGES) {
            call.on(event, refresh);
            this.#handlers.push([event, refresh]);
        }
        call.on("active-speaker-change", speaker);
        this.#handlers.push(["active-speaker-change", speaker as () => void]);
        const devices = () => void this.#refreshDevices();
        for (const event of [
            "joined-meeting",
            "available-devices-updated",
            "selected-devices-updated",
        ] as const) {
            call.on(event, devices);
            this.#handlers.push([event, devices]);
        }
        this.#refresh();
    }

    /** The call is over: stop its audio and forget it. */
    detach(): void {
        const call = this.#call;
        if (call !== undefined) {
            for (const [event, handler] of this.#handlers) {
                call.off(event, handler);
            }
        }
        this.#handlers = [];
        this.#call = undefined;
        this.#audio.clear();
        this.participants = {};
        this.activeSpeaker = undefined;
        this.devices = { mics: [], speakers: [], cameras: [] };
    }

    /**
     * Uses this microphone or camera for the call, or plays the call's audio through this speaker.
     * The speaker is the app's choice, not Daily's: the call object plays nothing itself, so its
     * output setting would reach none of the call's audio (RemoteAudio plays it).
     */
    async selectDevice(kind: CallDeviceKind, id: string): Promise<void> {
        const call = this.#call;
        if (call === undefined) return;
        if (kind === "mic") await call.setInputDevicesAsync({ audioDeviceId: id });
        if (kind === "camera") await call.setInputDevicesAsync({ videoDeviceId: id });
        if (kind === "speaker") await this.#audio.setSink(id);
        await this.#refreshDevices();
    }

    /** Turns the camera round: the front and back cameras of a phone, by their facing mode. */
    async flipCamera(): Promise<void> {
        const call = this.#call;
        if (call === undefined) return;
        await call.cycleCamera({ preferDifferentFacingMode: true });
        await this.#refreshDevices();
    }

    async #refreshDevices() {
        const call = this.#call;
        if (call === undefined) return;
        const [{ devices }, inputs] = await Promise.all([
            call.enumerateDevices(),
            call.getInputDevices(),
        ]);
        if (call !== this.#call) return;
        const lists = deviceLists(devices);
        const id = (device: object) => ("deviceId" in device ? String(device.deviceId) : undefined);
        this.devices = {
            ...lists,
            // only where the browser lets the app choose where audio plays
            speakers: this.#audio.canChooseSink ? lists.speakers : [],
            mic: id(inputs.mic),
            camera: id(inputs.camera),
            speaker: this.#audio.sinkId,
        };
    }

    #refresh() {
        // Daily changes one participants object in place, so the view is given a copy: the same
        // object again would be no change to it
        const participants = { ...(this.#call?.participants() ?? {}) };
        this.participants = participants;
        this.#audio.sync(remoteAudioTracks(participants));
    }
}
