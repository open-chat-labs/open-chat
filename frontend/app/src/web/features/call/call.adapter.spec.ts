import { describe, expect, test } from "vitest";
import { headerCall } from "./call.adapter";

const privateChat = { canStart: true, isPublic: false, chatCall: undefined, activeCall: undefined };

describe("the conversation header's call buttons", () => {
    // #10125 invariant 1, in the new UI's header: a private chat offers audio and video, a public
    // one a broadcast, and a call going on is joined as the type it was started as
    test("invariant 1: what the header starts or joins", () => {
        expect(headerCall(privateChat)).toEqual({
            show: true,
            label: "videoCall.startVideo",
            icon: "video",
            primary: { kind: "start", callType: "default", join: false },
            voice: true,
        });
        expect(headerCall({ ...privateChat, isPublic: true })).toMatchObject({
            primary: { kind: "start", callType: "broadcast", join: false },
            voice: false,
        });
        expect(headerCall({ ...privateChat, chatCall: "audio" })).toEqual({
            show: true,
            label: "videoCall.joinAudio",
            icon: "phone",
            primary: { kind: "start", callType: "audio", join: true },
            voice: false,
        });
        expect(headerCall({ ...privateChat, canStart: false })).toEqual({ show: false });
    });

    // A call the user has just started is theirs before the chat's summary says a call is going
    // on: the header must never offer to start another there, which would end theirs
    test("the user's own call, before the chat knows of it, offers no new call", () => {
        const starting = {
            ...privateChat,
            activeCall: { callType: "default" as const, showing: true },
        };
        expect(headerCall(starting)).toEqual({ show: false });
        expect(
            headerCall({ ...starting, activeCall: { callType: "audio", showing: false } }),
        ).toEqual({
            show: true,
            label: "videoCall.join",
            icon: "phone",
            primary: { kind: "return" },
            voice: false,
        });
    });
});
