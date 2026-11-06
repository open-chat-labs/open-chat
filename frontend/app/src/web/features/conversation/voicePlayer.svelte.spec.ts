import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@src/utils/media", () => ({ setPlayingMedia: vi.fn() }));

// an audio element as far as the player uses it: its events, and a clock the test moves
class FakeAudio extends EventTarget {
    currentTime = 0;
    src = "";
    playbackRate = 1;
    defaultPlaybackRate = 1;
    play(): Promise<void> {
        this.dispatchEvent(new Event("play"));
        return Promise.resolve();
    }
    pause(): void {
        this.dispatchEvent(new Event("pause"));
    }
    removeAttribute(): void {}
}

let audio: FakeAudio;
let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;
const runFrame = () => {
    const due = [...frames.values()];
    frames.clear();
    due.forEach((f) => f(0));
};

beforeEach(() => {
    frames = new Map();
    nextFrame = 1;
    vi.stubGlobal(
        "Audio",
        class extends FakeAudio {
            constructor() {
                super();
                // eslint-disable-next-line @typescript-eslint/no-this-alias -- the test's handle on the player's element
                audio = this;
            }
        },
    );
    vi.stubGlobal("requestAnimationFrame", (f: FrameRequestCallback) => {
        frames.set(nextFrame, f);
        return nextFrame++;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
});

afterEach(() => vi.unstubAllGlobals());

const { VoicePlayer } = await import("./voicePlayer.svelte");

// timeupdate comes a few times a second (about once in a WebView): the waveform's handle would
// move in jumps, so while a message plays its time is read every frame
describe("a voice message's time while it plays", () => {
    test("follows the recording each frame, not only on timeupdate", () => {
        const player = new VoicePlayer();
        player.play("m1", "blob:m1");

        audio.currentTime = 0.016;
        runFrame();
        expect(player.time("m1")).toBeCloseTo(0.016);
        audio.currentTime = 0.033;
        runFrame();
        expect(player.time("m1")).toBeCloseTo(0.033);
    });

    test("stops following when paused, keeping where it stopped", () => {
        const player = new VoicePlayer();
        player.play("m1", "blob:m1");
        audio.currentTime = 1.25;
        player.pause("m1");

        expect(player.time("m1")).toBeCloseTo(1.25);
        expect(frames.size).toBe(0);
        audio.currentTime = 3;
        runFrame();
        expect(player.time("m1")).toBeCloseTo(1.25);
    });

    test("goes back to the start when it ends, and stops following", () => {
        const player = new VoicePlayer();
        player.play("m1", "blob:m1");
        audio.currentTime = 4;
        runFrame();
        audio.dispatchEvent(new Event("ended"));

        expect(player.time("m1")).toBe(0);
        expect(frames.size).toBe(0);
    });

    test("a stopped player follows nothing", () => {
        const player = new VoicePlayer();
        player.play("m1", "blob:m1");
        player.stop();

        expect(frames.size).toBe(0);
        expect(player.time("m1")).toBe(0);
    });
});
