import {
    currentUserStore,
    anonymousUser,
    type ChatIdentifier,
    type OpenChat,
    type VideoCallRoom,
} from "@client";
import { activeVideoCall, hasPresence } from "@stores/video";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CallSession, type CallFrameOptions } from "./callSession.svelte";

// The call's frame. `present` is how many are in the call.
const frame = vi.hoisted(() => ({
    present: 1,
    leave: vi.fn(),
}));

vi.mock("@daily-co/daily-js", () => ({
    default: {
        createFrame: () => ({
            on: () => {},
            join: async () => {},
            leave: frame.leave,
            destroy: async () => {},
            setTheme: () => {},
            participants: () => ({ local: { session_id: "me" } }),
            participantCounts: () => ({ present: frame.present }),
        }),
    },
}));

const direct: ChatIdentifier = { kind: "direct_chat", userId: "them" };
const group: ChatIdentifier = { kind: "group_chat", groupId: "rrkah-fqaaa-aaaaa-aaaaq-cai" };

const options: CallFrameOptions = {
    title: "them",
    username: "me",
    speakerView: false,
    cameraOn: true,
    micOn: true,
    theme: { colors: {} },
};

// What the call in progress in each chat is, if there is one
let inProgress: Record<string, "default" | "broadcast" | undefined> = {};

const client = {
    lookupChatSummary: vi.fn((chatId: ChatIdentifier) => {
        const callType = inProgress[chatId.kind];
        return { videoCallInProgress: callType ? { callType } : undefined };
    }),
    filterRightPanelHistory: vi.fn(),
    popRightPanelHistory: vi.fn(),
    endVideoCall: vi.fn(async () => {}),
    getVideoCallTeardownToken: vi.fn(async () => "token"),
    startOrJoinVideoCall: vi.fn(
        async (
            _chatId: ChatIdentifier,
            callType: VideoCallRoom["callType"],
            join: boolean,
            enterRoom: (room: VideoCallRoom) => Promise<void>,
        ) => {
            await enterRoom({ token: "t", roomName: "r", messageId: 7n, callType, joining: join });
            return { kind: "joined" };
        },
    ),
} as unknown as OpenChat;

describe("a call", () => {
    let session: CallSession;
    const container = document.createElement("div");

    beforeEach(() => {
        currentUserStore.set({ ...anonymousUser(), userId: "me", username: "me" });
        session = new CallSession(client, () => options, vi.fn());
    });

    afterEach(() => {
        activeVideoCall.endCall();
        currentUserStore.set(anonymousUser());
        inProgress = {};
        frame.present = 1;
        vi.clearAllMocks();
    });

    // Invariant: asking for a call while in another asks to switch first, and leaves the
    // current call alone until the user says yes
    test("asking for a call while in another asks to switch and starts nothing", async () => {
        activeVideoCall.joining(group, "default");

        expect(
            await session.startOrJoin(container, {
                chatId: direct,
                callType: "default",
                join: false,
            }),
        ).toEqual({ kind: "confirm_switch" });
        expect(client.startOrJoinVideoCall).not.toHaveBeenCalled();
        expect(activeVideoCall.current()?.chatId).toEqual(group);
        expect(session.confirmSwitchTo?.chatId).toEqual(direct);
    });

    // Invariant: a call joins as the type it was started as, whatever the button asked for
    test("joining a call joins it as the type it was started as", async () => {
        inProgress = { group_chat: "broadcast" };

        await session.startOrJoin(container, { chatId: group, callType: "default", join: true });

        expect(client.startOrJoinVideoCall).toHaveBeenCalledWith(
            group,
            "broadcast",
            true,
            expect.any(Function),
        );
        expect(activeVideoCall.current()?.callType).toBe("broadcast");
    });

    // Invariant: a call that could not start, or had ended, is not left showing as joining
    test("a call that fails to start is no longer shown", async () => {
        vi.mocked(client.startOrJoinVideoCall)
            .mockResolvedValueOnce({
                kind: "failed",
                message: { kind: "resource_key", key: "videoCall.callFailed", lowercase: false },
            })
            .mockResolvedValueOnce({ kind: "no_meeting" });

        for (const kind of ["failed", "no_meeting"]) {
            const outcome = await session.startOrJoin(container, {
                chatId: direct,
                callType: "default",
                join: false,
            });

            expect(outcome.kind).toBe(kind);
            expect(activeVideoCall.current()).toBeUndefined();
        }
    });

    // Invariant: confirming a switch leaves the current call and starts the one asked for
    test("confirming a switch leaves the current call for the new one", async () => {
        activeVideoCall.joining(group, "default");
        await session.startOrJoin(container, { chatId: direct, callType: "default", join: false });

        expect(await session.switchCall(container)).toEqual({ kind: "joined" });
        expect(client.startOrJoinVideoCall).toHaveBeenCalledWith(
            direct,
            "default",
            false,
            expect.any(Function),
        );
        expect(activeVideoCall.current()?.chatId).toEqual(direct);
        expect(session.confirmSwitchTo).toBeUndefined();
    });

    // Invariant: hanging up as the last one there ends the call for everyone; with anyone else
    // there, or as an audience member without presence, it only leaves
    test("hanging up ends the call only for the last one there", async () => {
        await session.startOrJoin(container, { chatId: group, callType: "default", join: false });
        hasPresence.set(true);

        frame.present = 2;
        session.hangup();
        expect(client.endVideoCall).not.toHaveBeenCalled();
        expect(frame.leave).toHaveBeenCalledTimes(1);

        // a broadcast's audience member leaving while only the host is on stage
        frame.present = 1;
        hasPresence.set(false);
        session.hangup();
        expect(client.endVideoCall).not.toHaveBeenCalled();
        expect(frame.leave).toHaveBeenCalledTimes(2);

        hasPresence.set(true);
        session.hangup();
        expect(client.endVideoCall).toHaveBeenCalledWith(group, 7n);
        expect(frame.leave).toHaveBeenCalledTimes(3);
    });
});
