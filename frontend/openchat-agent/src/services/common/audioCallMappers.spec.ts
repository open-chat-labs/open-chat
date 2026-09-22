import { describe, expect, test } from "vitest";
import { apiAccessTokenType } from "../localUserIndex/mappers";
import { messageContent, videoCallInProgress } from "./chatMappersV2";

const USER = new Uint8Array([1]);

function callInProgress(audio_only?: boolean) {
    return {
        started: BigInt(1),
        started_by: USER,
        event_index: 1,
        message_index: 1,
        message_id: BigInt(1),
        call_type: "Default" as const,
        audio_only,
        joined_by_current_user: false,
    };
}

function callContent(audio_only?: boolean) {
    return {
        VideoCall: {
            call_type: "Default" as const,
            audio_only,
            participants: [],
            hidden_participants: 0,
        },
    };
}

// #9455 invariant 11: the call message and the ring name the call's kind. Both are driven by
// the type these mappers produce, so a mapper that drops the flag shows every audio call as a
// video call, and a join would then ask for the camera.
describe("audio calls through the mappers", () => {
    test("invariant 11: a call in progress marked audio only is an audio call", () => {
        expect(videoCallInProgress(callInProgress(true)).callType).toEqual("audio");
        expect(videoCallInProgress(callInProgress(false)).callType).toEqual("default");
    });

    test("invariant 11: a call in progress from a canister that predates audio calls is a video call", () => {
        expect(videoCallInProgress(callInProgress()).callType).toEqual("default");
    });

    test("invariant 11: a call message marked audio only is an audio call", () => {
        expect(messageContent(callContent(true), "sender")).toMatchObject({ callType: "audio" });
        expect(messageContent(callContent(), "sender")).toMatchObject({ callType: "default" });
    });

    // #9455 invariant 12, website half: the start token request names the kind that was chosen
    test("invariant 12: starting an audio call asks for a default call that is audio only", () => {
        const chatId = { kind: "group_chat" as const, groupId: "aaaaa-aa" };
        expect(
            apiAccessTokenType({ kind: "start_video_call", callType: "audio", chatId }),
        ).toMatchObject({
            StartVideoCall: { call_type: "Default", audio_only: true },
        });
        expect(
            apiAccessTokenType({ kind: "start_video_call", callType: "default", chatId }),
        ).toMatchObject({
            StartVideoCall: { call_type: "Default", audio_only: false },
        });
        expect(
            apiAccessTokenType({ kind: "start_video_call", callType: "broadcast", chatId }),
        ).toMatchObject({
            StartVideoCall: { call_type: "Broadcast", audio_only: false },
        });
    });
});
