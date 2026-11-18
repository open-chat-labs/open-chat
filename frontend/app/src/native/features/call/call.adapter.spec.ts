import { describe, expect, test } from "vitest";
import type { CallPersonView, CallSelfView } from "@src/logic/video/callPeople";
import {
    callControls,
    callScreenShows,
    callStage,
    headerCallButtons,
    miniCallShows,
} from "./call.adapter";

const person = (id: string): CallPersonView => ({
    id,
    name: id,
    initial: id[0],
    grad: "g",
    muted: false,
    speaking: false,
    stream: null,
});
const self: CallSelfView = {
    initial: "M",
    grad: "g",
    stream: null,
    muted: false,
    camera: true,
    sharing: false,
    screenStream: null,
};
const isJoin = (request: unknown, callType: string) =>
    JSON.stringify(request) === JSON.stringify({ callType, join: true });
const ids = (stage: ReturnType<typeof callStage>) => stage.tiles.map((t) => t.id);

describe("the native call", () => {
    test("the header starts video or voice, or a broadcast in public", () => {
        const base = { canStart: true, isPublic: false, chatCall: undefined, ownCall: undefined };
        expect(headerCallButtons(base).map((b) => [b.icon, b.request, b.live])).toEqual([
            ["video", { callType: "default", join: false }, false],
            ["phone", { callType: "audio", join: false }, false],
        ]);
        expect(headerCallButtons({ ...base, isPublic: true }).map((b) => b.request)).toEqual([
            { callType: "broadcast", join: false },
        ]);
        expect(headerCallButtons({ ...base, canStart: false })).toEqual([]);
    });

    // A call going on here is joined, never started beside, from either button, as the type it was
    // started as; the button of its kind is the green one. In the user's own call, both go back
    test("the header joins the call going on from the button of its kind, or goes back to the user's", () => {
        const base = { canStart: true, isPublic: false, ownCall: undefined };
        const voiceCall = headerCallButtons({ ...base, chatCall: "audio" });
        expect(voiceCall.map((b) => [b.icon, b.live])).toEqual([
            ["video", false],
            ["phone", true],
        ]);
        expect(voiceCall.every((b) => isJoin(b.request, "audio"))).toBe(true);

        const videoCall = headerCallButtons({ ...base, chatCall: "default" });
        expect(videoCall.map((b) => b.live)).toEqual([true, false]);
        expect(videoCall.every((b) => isJoin(b.request, "default"))).toBe(true);

        const own = headerCallButtons({ ...base, chatCall: "default", ownCall: "default" });
        expect(own.map((b) => [b.request, b.live])).toEqual([
            ["return", false],
            ["return", false],
        ]);
    });

    test("video up to 3 floats the user's camera over the others; 4 or more share a 2-column grid", () => {
        const two = callStage([person("a"), person("b")], self, true, "You");
        expect(two).toMatchObject({ floatSelf: true, columns: 1 });
        expect(ids(two)).toEqual(["a", "b"]);

        const four = callStage([person("a"), person("b"), person("c")], self, true, "You");
        expect(four).toMatchObject({ floatSelf: false, columns: 2 });
        expect(ids(four)).toEqual(["a", "b", "c", "self"]);

        // voice: everyone as an avatar, the user too
        expect(ids(callStage([person("a")], self, false, "You"))).toEqual(["a", "self"]);
    });

    test("invariant 5: a voice call shows no camera control", () => {
        const state = { muted: false, camera: false, speaker: undefined, speak: undefined };
        expect(callControls({ ...state, video: false }).map((c) => c.id)).toEqual(["mic", "leave"]);
        expect(callControls({ ...state, video: true }).map((c) => c.id)).toEqual([
            "mic",
            "camera",
            "leave",
        ]);
    });

    test("invariant 7: Speaker shows only where the route can be switched, as the route reported", () => {
        const state = { video: false, muted: false, camera: false, speak: undefined };
        expect(callControls({ ...state, speaker: undefined }).some((c) => c.id === "speaker")).toBe(
            false,
        );
        expect(callControls({ ...state, speaker: true }).find((c) => c.id === "speaker")?.on).toBe(
            true,
        );
        expect(callControls({ ...state, speaker: false }).find((c) => c.id === "speaker")?.on).toBe(
            false,
        );
    });

    test("a broadcast viewer asks to speak in place of Mute and Camera", () => {
        const controls = callControls({
            video: true,
            muted: true,
            camera: false,
            speaker: undefined,
            speak: "ask",
        });
        expect(controls.map((c) => c.id)).toEqual(["ask", "leave"]);
    });

    test("invariant 8: the minimised call shows exactly while a call is minimised", () => {
        expect(miniCallShows(undefined)).toBe(false);
        expect(miniCallShows({ view: "default" })).toBe(false);
        expect(miniCallShows({ view: "minimised" })).toBe(true);
    });

    test("invariant 1: where the app doesn't draw calls (iOS), the call screen never shows", () => {
        expect(callScreenShows({ view: "default" }, false)).toBe(false);
        expect(callScreenShows({ view: "default" }, true)).toBe(true);
        expect(callScreenShows({ view: "minimised" }, true)).toBe(false);
        expect(callScreenShows(undefined, true)).toBe(false);
    });
});
