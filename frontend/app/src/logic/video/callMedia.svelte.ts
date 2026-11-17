import type { DailyCall, DailyEvent } from "@daily-co/daily-js";
import { remoteAudioTracks, type CallParticipants } from "./callPeople";
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
    }

    #refresh() {
        // Daily changes one participants object in place, so the view is given a copy: the same
        // object again would be no change to it
        const participants = { ...(this.#call?.participants() ?? {}) };
        this.participants = participants;
        this.#audio.sync(remoteAudioTracks(participants));
    }
}
