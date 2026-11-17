import type { DailyCall, DailyParticipant, DailyTrackState } from "@daily-co/daily-js";
import { flushSync } from "svelte";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
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

// A Daily call object that only does what CallMedia uses of it. Like Daily's, `participants()`
// returns the same object every time, changed in place.
function fakeCall() {
    const handlers = new Map<string, Set<() => void>>();
    const participants: CallParticipants = {};
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
            for (const key of Object.keys(participants)) delete participants[key];
            Object.assign(participants, next);
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
    afterEach(() => {
        vi.restoreAllMocks();
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

        // someone joins with their audio still loading, and is heard once it plays
        set(
            {
                local: participant("me", { local: true }),
                b: participant("b", { audio: on(track("b")) }),
                d: participant("d", {
                    audio: { state: "loading", subscribed: true } as DailyTrackState,
                }),
            },
            "participant-joined",
        );
        expect(playing(root)).toEqual(["b:audio"]);
        set(
            {
                local: participant("me", { local: true }),
                b: participant("b", { audio: on(track("b")) }),
                d: participant("d", { audio: on(track("d")) }),
            },
            "track-started",
        );
        expect(playing(root)).toEqual(["b:audio", "d:audio"]);

        // the call is over: nothing keeps playing
        media.detach();
        expect(playing(root)).toEqual([]);
    });

    // Daily changes its participants object in place, so the call view must still see who joins
    test("the call view follows the participants as Daily changes them", () => {
        const media = new CallMedia(new RemoteAudio(document.createElement("div"), fakeStream));
        const { call, set } = fakeCall();
        const seen: number[] = [];
        const cleanup = $effect.root(() => {
            $effect(() => {
                seen.push(Object.keys(media.participants).length);
            });
        });
        media.attach(call);
        flushSync();
        set({ a: participant("a") }, "participant-joined");
        flushSync();
        set({ a: participant("a"), b: participant("b") }, "participant-joined");
        flushSync();
        expect(seen.at(-1)).toEqual(2);
        cleanup();
        media.detach();
    });

    test("audio the browser refused to start plays on the user's next tap or key", async () => {
        const play = vi
            .spyOn(HTMLMediaElement.prototype, "play")
            .mockRejectedValueOnce(new DOMException("blocked", "NotAllowedError"))
            .mockResolvedValue(undefined);
        const root = document.body.appendChild(document.createElement("div"));
        const audio = new RemoteAudio(root, fakeStream);
        audio.sync(remoteAudioTracks({ a: participant("a", { audio: on(track("a")) }) }));
        await Promise.resolve();
        await Promise.resolve();
        expect(play).toHaveBeenCalledTimes(1);

        document.dispatchEvent(new Event("pointerdown"));
        expect(play).toHaveBeenCalledTimes(2);
        audio.clear();
        root.remove();
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

    // The user's chosen speaker plays every remote voice: the ones playing when they choose it,
    // and those that start afterwards (the call object plays them in our audio elements, so
    // Daily's own output setting would reach none of them)
    test("a chosen speaker plays every remote voice, now and later", async () => {
        const sinks: string[] = [];
        const setSinkId = vi.fn(async function (this: HTMLAudioElement, id: string) {
            sinks.push(`${this.dataset.callAudio}=${id}`);
        });
        Object.defineProperty(HTMLMediaElement.prototype, "setSinkId", {
            value: setSinkId,
            configurable: true,
        });
        try {
            const root = document.createElement("div");
            const audio = new RemoteAudio(root, fakeStream);
            const a = track("a");
            audio.sync(remoteAudioTracks({ a: participant("a", { audio: on(a) }) }));
            await audio.setSink("headset");
            audio.sync(
                remoteAudioTracks({
                    a: participant("a", { audio: on(a) }),
                    b: participant("b", { audio: on(track("b")) }),
                }),
            );
            expect(sinks.sort()).toEqual(["a:audio=headset", "b:audio=headset"]);
            expect(audio.sinkId).toEqual("headset");
        } finally {
            delete (HTMLMediaElement.prototype as { setSinkId?: unknown }).setSinkId;
        }
    });

    test("a chosen microphone or camera is the one Daily sends", async () => {
        const media = new CallMedia(new RemoteAudio(document.createElement("div"), fakeStream));
        const { call } = fakeCall();
        const setInputDevicesAsync = vi.fn(async () => ({}));
        Object.assign(call, {
            setInputDevicesAsync,
            enumerateDevices: async () => ({ devices: [] }),
            getInputDevices: async () => ({ mic: {}, camera: {}, speaker: {} }),
        });
        media.attach(call);
        await media.selectDevice("mic", "usb-mic");
        await media.selectDevice("camera", "usb-cam");
        expect(setInputDevicesAsync).toHaveBeenCalledWith({ audioDeviceId: "usb-mic" });
        expect(setInputDevicesAsync).toHaveBeenCalledWith({ videoDeviceId: "usb-cam" });
        media.detach();
    });
});
