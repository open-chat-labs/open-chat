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
const ids = (stage: ReturnType<typeof callStage>) => stage.tiles.map((t) => t.id);

describe("the native call", () => {
    test("the header starts video or voice, a broadcast in public, joins the call on, or goes back", () => {
        const base = { canStart: true, isPublic: false, chatCall: undefined, ownCall: undefined };
        expect(headerCallButtons(base).map((b) => b.request)).toEqual([
            { callType: "default", join: false },
            { callType: "audio", join: false },
        ]);
        expect(headerCallButtons({ ...base, isPublic: true }).map((b) => b.request)).toEqual([
            { callType: "broadcast", join: false },
        ]);
        // joined as the type it was started as
        expect(headerCallButtons({ ...base, chatCall: "audio" })).toEqual([
            {
                icon: "phone",
                label: "native.call.join",
                request: { callType: "audio", join: true },
            },
        ]);
        expect(headerCallButtons({ ...base, ownCall: "default" }).map((b) => b.request)).toEqual([
            "return",
        ]);
        expect(headerCallButtons({ ...base, canStart: false })).toEqual([]);
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
