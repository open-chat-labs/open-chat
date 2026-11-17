import {
    callOffer,
    joinedCallType,
    startVideoOff,
    videoCallTypeFromWire,
    videoCallTypeToWire,
    type VideoCallType,
} from "./chat";

describe("video call type", () => {
    // #9455 invariant 2, website side: whatever the wire pair says, the type the website holds
    // is never an audio only broadcast, and nothing it sends describes one
    test("invariant 2: an audio only broadcast cannot be held or sent", () => {
        expect(videoCallTypeFromWire("broadcast", true)).toEqual("broadcast");
        for (const t of ["default", "audio", "broadcast"] as VideoCallType[]) {
            const wire = videoCallTypeToWire(t);
            expect(wire.callType === "broadcast" && wire.audioOnly).toEqual(false);
            expect(videoCallTypeFromWire(wire.callType, wire.audioOnly)).toEqual(t);
        }
    });

    // #9455 invariant 11: a call is named by its kind, and a call or ring message that says
    // nothing about audio, from a canister that predates audio calls, is a video call
    test("invariant 11: a call with no audio only flag is a video call", () => {
        expect(videoCallTypeFromWire("default")).toEqual("default");
        expect(videoCallTypeFromWire("default", false)).toEqual("default");
        expect(videoCallTypeFromWire("default", true)).toEqual("audio");
    });

    // #9455 invariant 2, sending side: websites that predate audio calls validate canister
    // responses against "default" | "broadcast", so the canisters and the bridge are told of an
    // audio call as "default" plus the flag
    test("invariant 2: an audio call travels as a default call with the audio only flag", () => {
        expect(videoCallTypeToWire("audio")).toEqual({ callType: "default", audioOnly: true });
    });

    // #9455 invariant 10: the website joins an audio call with the camera off whatever the
    // videoCameraOn setting says
    test("invariant 10: an audio call starts with the camera off", () => {
        expect(startVideoOff("audio", true)).toEqual(true);
        expect(startVideoOff("audio", false)).toEqual(true);
        expect(startVideoOff("default", true)).toEqual(false);
        expect(startVideoOff("default", false)).toEqual(true);
        expect(startVideoOff("broadcast", true)).toEqual(false);
    });

    // #9455 invariant 10: the join buttons ask for a default call, so a join must take the
    // running call's type or an audio call would be joined as video
    test("invariant 10: joining takes the type of the call in progress", () => {
        expect(joinedCallType("default", "audio")).toEqual("audio");
        expect(joinedCallType("default", undefined)).toEqual("default");
    });

    // #10125 invariant 1: a public chat's new call is a broadcast, a private chat's is audio or
    // video as chosen, and a running call is joined as the type it was started as
    test("invariant 1: what a chat's call button offers", () => {
        const base = { canStart: true, isPublic: false, inCall: false, canStartBroadcast: true };
        expect(callOffer(base)).toEqual({ kind: "choose" });
        expect(callOffer({ ...base, isPublic: true })).toEqual({ kind: "broadcast" });
        expect(callOffer({ ...base, inProgress: "audio" })).toEqual({
            kind: "join",
            callType: "audio",
        });
        expect(callOffer({ ...base, isPublic: true, inProgress: "broadcast" })).toEqual({
            kind: "join",
            callType: "broadcast",
        });
        expect(callOffer({ ...base, inProgress: "default", inCall: true })).toEqual({
            kind: "leave",
        });
    });

    test("a chat whose calls the user can't start offers none, but a running call can be joined", () => {
        const base = { canStart: false, isPublic: false, inCall: false, canStartBroadcast: true };
        expect(callOffer(base)).toEqual({ kind: "none" });
        expect(callOffer({ ...base, inProgress: "default" })).toEqual({
            kind: "join",
            callType: "default",
        });
        // iOS can watch a broadcast but not start one yet (#10445)
        expect(
            callOffer({ ...base, canStart: true, isPublic: true, canStartBroadcast: false }),
        ).toEqual({
            kind: "none",
        });
    });
});
