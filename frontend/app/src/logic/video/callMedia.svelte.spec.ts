import type { DailyCall, DailyParticipant, DailyTrackState } from "@daily-co/daily-js";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { CallMedia } from "./callMedia.svelte";
import { callPeople, remoteAudioTracks, type CallParticipants } from "./callPeople";
import { RemoteAudio } from "./remoteAudio";

const track = (id: string) => ({ id, kind: "audio" }) as unknown as MediaStreamTrack;
const on = (t: MediaStreamTrack): DailyTrackState =>
    ({ state: "playable", subscribed: true, track: t, persistentTrack: t }) as DailyTrackState;
const off: DailyTrackState = { state: "off", subscribed: true } as DailyTrackState;

function participant(
    session: string,
    {
        local = false,
        audio = off,
        video = off,
        screenVideo = off,
        screenAudio = off,
    }: Partial<Record<"audio" | "video" | "screenVideo" | "screenAudio", DailyTrackState>> & {
        local?: boolean;
    } = {},
): DailyParticipant {
    return {
        session_id: session,
        user_id: `user-${session}`,
        user_name: session,
        local,
        tracks: { audio, video, screenVideo, screenAudio },
    } as unknown as DailyParticipant;
}

const fakeStream = (t: MediaStreamTrack) => ({ id: `stream-${t.id}` }) as unknown as MediaStream;
const face = (userId: string, userName: string) => ({
    name: userName,
    initial: userName.slice(0, 1),
    grad: userId,
});

// A Daily call object that only does what CallMedia uses of it
function fakeCall() {
    const handlers = new Map<string, Set<() => void>>();
    let participants: CallParticipants = {};
    const call = {
        on: (event: string, handler: () => void) => {
            if (!handlers.has(event)) handlers.set(event, new Set());
            handlers.get(event)!.add(handler);
            return call;
        },
        off: (event: string, handler: () => void) => {
            handlers.get(event)?.delete(handler);
            return call;
        },
        participants: () => participants,
    };
    return {
        call: call as unknown as DailyCall,
        set(next: CallParticipants, event = "participant-updated") {
            participants = next;
            handlers.get(event)?.forEach((h) => h());
        },
    };
}

const playing = (root: HTMLElement) =>
    [...root.querySelectorAll("audio")].map((a) => a.dataset.callAudio).sort();

describe("a call made with Daily's call object", () => {
    // jsdom can't play media
    beforeEach(() => {
        vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    });

    // #10124 / #10125 invariant 6: Daily's call object draws nothing, so the app plays every
    // remote participant's audio itself; a missed track is someone the user can't hear
    test("invariant 6: every remote participant's audio is played while the call is up", () => {
        const root = document.createElement("div");
        const media = new CallMedia(new RemoteAudio(root, fakeStream));
        const { call, set } = fakeCall();
        media.attach(call);

        set(
            {
                local: participant("me", { local: true, audio: on(track("mine")) }),
                a: participant("a", { audio: on(track("a")) }),
                b: participant("b", { audio: on(track("b")), screenAudio: on(track("b-screen")) }),
                c: participant("c"),
            },
            "participant-joined",
        );
        // both others' voices and the sound of b's shared screen; never the user's own, nor
        // the muted c
        expect(playing(root)).toEqual(["a:audio", "b:audio", "b:screenAudio"]);

        set(
            {
                local: participant("me", { local: true }),
                b: participant("b", { audio: on(track("b")) }),
            },
            "participant-left",
        );
        expect(playing(root)).toEqual(["b:audio"]);

        // the call is over: nothing keeps playing
        media.detach();
        expect(playing(root)).toEqual([]);
    });

    test("a participant whose audio track changes is played from the new track", () => {
        const root = document.createElement("div");
        const audio = new RemoteAudio(root, fakeStream);
        audio.sync(remoteAudioTracks({ a: participant("a", { audio: on(track("1")) }) }));
        const first = root.querySelector("audio");
        audio.sync(remoteAudioTracks({ a: participant("a", { audio: on(track("2")) }) }));
        const second = root.querySelector("audio");
        expect(second).not.toBe(first);
        expect((second?.srcObject as unknown as { id: string }).id).toEqual("stream-2");
    });

    test("the call view shows the others' video, mute and speaking, and the user's own", () => {
        const { people, self } = callPeople(
            {
                me: participant("me", { local: true, video: on(track("cam")) }),
                a: participant("a", { audio: on(track("a")), video: on(track("a-cam")) }),
                b: participant("b", {
                    video: on(track("b-cam")),
                    screenVideo: on(track("b-screen")),
                }),
            },
            "a",
            face,
            fakeStream,
        );
        expect(people).toEqual([
            expect.objectContaining({
                id: "a",
                muted: false,
                speaking: true,
                stream: fakeStream(track("a-cam")),
            }),
            // a shared screen is shown over the camera
            expect.objectContaining({
                id: "b",
                muted: true,
                speaking: false,
                stream: fakeStream(track("b-screen")),
            }),
        ]);
        expect(self).toEqual(
            expect.objectContaining({
                camera: true,
                muted: true,
                sharing: false,
                stream: fakeStream(track("cam")),
            }),
        );
    });
});
