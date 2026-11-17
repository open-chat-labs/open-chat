import {
    currentUserStore,
    anonymousUser,
    type ChatIdentifier,
    type OpenChat,
    type VideoCallRoom,
} from "@client";
import { activeVideoCall, hasPresence } from "@stores/video";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { CallMedia } from "./callMedia.svelte";
import { DAILY_CALL_MACHINE_VERSION } from "./dailyCallMachine";
import { ANSWER_HANGUP_WAIT_MS, CallSession, type CallFrameOptions } from "./callSession.svelte";

// The call's frame. `present` is how many are in the call.
const frame = vi.hoisted(() => ({
    present: 1,
    leave: vi.fn(),
    created: vi.fn(),
    callObject: vi.fn(),
}));

// The iOS shell, for the calls that run natively
const shell = vi.hoisted(() => ({
    ios: false,
    onEvent: undefined as ((raw: unknown) => void) | undefined,
    invoke: vi.fn(),
}));

vi.mock("@shared", async (original) => ({
    ...(await original<typeof import("@shared")>()),
    isIosTauriApp: () => shell.ios,
}));

vi.mock("@tauri-apps/api/core", () => ({
    invoke: shell.invoke,
    addPluginListener: async (_plugin: string, _event: string, cb: (raw: unknown) => void) => {
        shell.onEvent = cb;
        return { unregister: () => {} };
    },
}));

vi.mock("@daily-co/daily-js", () => ({
    default: {
        createFrame: () => {
            frame.created();
            return makeFrame();
        },
        createCallObject: (properties: unknown) => {
            frame.callObject(properties);
            return { ...makeFrame(), off: () => {}, participants: () => ({}) };
        },
    },
}));

const makeFrame = vi.hoisted(() => () => ({
    on: () => {},
    join: async () => {},
    leave: frame.leave,
    destroy: async () => {},
    setTheme: () => {},
    participants: () => ({ local: { session_id: "me" } }),
    participantCounts: () => ({ present: frame.present }),
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
        return { videoCallInProgress: callType ? { callType, messageId: 7n } : undefined };
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

    // Invariant: an answer on the native ring (End & answer, End & Accept) is the user's choice,
    // so it replaces the call in progress without asking. The shell has already hung that call
    // up, so the answer waits for it to go instead of leaving it a second time.
    test("an answer from the native ring during a call switches without asking", async () => {
        vi.useFakeTimers();
        try {
            await session.startOrJoin(container, {
                chatId: group,
                callType: "default",
                join: false,
            });

            const answering = session.startOrJoin(container, {
                chatId: direct,
                callType: "default",
                join: true,
                answer: true,
            });
            await vi.advanceTimersByTimeAsync(0);
            expect(session.confirmSwitchTo).toBeUndefined();
            expect(activeVideoCall.current()?.chatId).toEqual(group);
            expect(client.startOrJoinVideoCall).toHaveBeenCalledTimes(1);

            // the shell's hang-up lands: the old call leaves, which ends it, and the answer
            // joins at once rather than at the end of the wait
            activeVideoCall.endCall();
            await vi.advanceTimersByTimeAsync(0);
            expect(client.startOrJoinVideoCall).toHaveBeenCalledTimes(2);
            expect(await answering).toEqual({ kind: "joined" });
            expect(activeVideoCall.current()?.chatId).toEqual(direct);
        } finally {
            vi.useRealTimers();
        }
    });

    // Invariant: a shell that answers without hanging up first (every APK before call waiting)
    // still gets the switch, with the old call ended before the new one joins, so its teardown
    // can't end the new call (#10398 invariant 25)
    test("an answer from the native ring ends the old call itself when no hang-up comes", async () => {
        vi.useFakeTimers();
        const endCall = vi.spyOn(activeVideoCall, "endCall");
        try {
            await session.startOrJoin(container, {
                chatId: group,
                callType: "default",
                join: false,
            });
            vi.mocked(client.startOrJoinVideoCall).mockClear();

            const answering = session.startOrJoin(container, {
                chatId: direct,
                callType: "default",
                join: true,
                answer: true,
            });
            await vi.advanceTimersByTimeAsync(ANSWER_HANGUP_WAIT_MS + 100);

            expect(await answering).toEqual({ kind: "joined" });
            expect(endCall).toHaveBeenCalledBefore(vi.mocked(client.startOrJoinVideoCall));
            expect(activeVideoCall.current()?.chatId).toEqual(direct);
        } finally {
            endCall.mockRestore();
            vi.useRealTimers();
        }
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

    // #10124: the legacy trees keep Daily's prebuilt frame; only the new UI makes calls with the
    // call object, and it never creates the frame
    test("the legacy trees make their calls in Daily's prebuilt frame", async () => {
        await session.startOrJoin(container, { chatId: direct, callType: "default", join: false });

        expect(frame.created).toHaveBeenCalledOnce();
        expect(frame.callObject).not.toHaveBeenCalled();
    });

    test("the new UI makes its calls with Daily's call object, never the frame", async () => {
        const media = { attach: vi.fn(), detach: vi.fn() };
        const callObjectSession = new CallSession(client, () => options, vi.fn(), {
            mode: "call_object",
            media: media as unknown as CallMedia,
        });
        await callObjectSession.startOrJoin(container, {
            chatId: direct,
            callType: "default",
            join: false,
        });

        expect(frame.callObject).toHaveBeenCalledOnce();
        expect(frame.created).not.toHaveBeenCalled();
        // Daily's code comes from our own origin as a script, never from Daily through eval
        expect(frame.callObject).toHaveBeenCalledWith(
            expect.objectContaining({
                dailyConfig: {
                    avoidEval: true,
                    callObjectBundleUrlOverride: `${location.origin}/daily/call-machine-object-bundle-${DAILY_CALL_MACHINE_VERSION}.js`,
                },
            }),
        );
        // its media follow the call, so its remote audio plays
        expect(media.attach).toHaveBeenCalledOnce();
    });

    // #10125: starting a call closes any thread open in the right column, which each tree keeps
    // its own way (the legacy trees' panel history; the new UI's URL)
    test("starting a call closes the thread open in the right column", async () => {
        await session.startOrJoin(container, { chatId: direct, callType: "default", join: false });
        expect(client.filterRightPanelHistory).toHaveBeenCalledOnce();

        const rightPanel = { closeThread: vi.fn(), afterLeave: vi.fn() };
        activeVideoCall.endCall();
        const web = new CallSession(client, () => options, vi.fn(), { rightPanel });
        await web.startOrJoin(container, { chatId: direct, callType: "default", join: false });
        expect(rightPanel.closeThread).toHaveBeenCalledOnce();
    });

    describe("on iOS", () => {
        const me = {
            sessionId: "me",
            userName: "me",
            local: true,
            owner: false,
            audio: true,
            video: false,
            hasPresence: true,
        };

        beforeEach(() => {
            shell.ios = true;
            shell.invoke.mockImplementation(async (command: string) =>
                command === "plugin:oc|native_call_join"
                    ? { json: JSON.stringify({ local: me, present: 2 }) }
                    : undefined,
            );
        });

        afterEach(() => {
            shell.ios = false;
            shell.invoke.mockImplementation(async () => undefined);
        });

        // Every tree that joins a call from inside the app ends the shell's ring for it, so the
        // phone doesn't keep ringing for a call the user has already joined
        test("joining a call from the app ends the native ring for that call", async () => {
            inProgress = { direct_chat: "default" };
            await session.startOrJoin(container, {
                chatId: direct,
                callType: "default",
                join: true,
            });

            expect(shell.invoke).toHaveBeenCalledWith("plugin:oc|call_ring_handled", {
                messageId: "7",
            });
        });

        test("invariant 19: a call runs natively and never creates the Daily frame", async () => {
            frame.created.mockClear();
            await session.startOrJoin(container, {
                chatId: direct,
                callType: "audio",
                join: false,
            });

            expect(frame.created).not.toHaveBeenCalled();
            expect(shell.invoke).toHaveBeenCalledWith(
                "plugin:oc|native_call_join",
                expect.objectContaining({ url: "https://openchat.daily.co/r", video: false }),
            );
        });

        test("invariant 20: the last one hanging up on the native screen ends the call", async () => {
            vi.mocked(client.endVideoCall).mockClear();
            await session.startOrJoin(container, {
                chatId: group,
                callType: "default",
                join: false,
            });

            shell.onEvent?.({
                json: JSON.stringify({
                    kind: "participant-left",
                    participant: { ...me, sessionId: "them", local: false },
                    present: 1,
                }),
            });
            expect(client.endVideoCall).not.toHaveBeenCalled();

            shell.onEvent?.({ json: JSON.stringify({ kind: "hangup" }) });
            expect(client.endVideoCall).toHaveBeenCalledWith(group, 7n);

            shell.onEvent?.({ json: JSON.stringify({ kind: "left" }) });
            expect(activeVideoCall.current()).toBeUndefined();
        });

        test("invariant 25: tearing down a finished call never touches the call after it", async () => {
            await session.startOrJoin(container, { chatId: direct, callType: "audio", join: true });
            shell.onEvent?.({ json: JSON.stringify({ kind: "left" }) });
            shell.invoke.mockClear();

            await session.startOrJoin(container, { chatId: direct, callType: "audio", join: true });

            expect(shell.invoke).toHaveBeenCalledWith(
                "plugin:oc|native_call_join",
                expect.anything(),
            );
            expect(shell.invoke).not.toHaveBeenCalledWith("plugin:oc|native_call_leave");
        });

        test("invariant 25: the finished call leaving never ends the call still joining after it", async () => {
            await session.startOrJoin(container, { chatId: direct, callType: "audio", join: true });
            await session.startOrJoin(container, { chatId: group, callType: "audio", join: true });
            // Switching: the shell holds the next join until the old call has left
            let joined: (value: unknown) => void = () => {};
            shell.invoke.mockClear();
            shell.invoke.mockImplementation((command: string) =>
                command === "plugin:oc|native_call_join"
                    ? new Promise((resolve) => (joined = resolve))
                    : Promise.resolve(undefined),
            );
            const next = session.switchCall(container);
            await vi.waitFor(() =>
                expect(shell.invoke).toHaveBeenCalledWith(
                    "plugin:oc|native_call_join",
                    expect.anything(),
                ),
            );

            shell.onEvent?.({ json: JSON.stringify({ kind: "left" }) });
            joined({ json: JSON.stringify({ local: me, present: 2 }) });
            await next;

            expect(activeVideoCall.current()?.chatId).toEqual(group);
        });

        test("invariant 20: the other party leaving a direct call ends it", async () => {
            vi.mocked(client.endVideoCall).mockClear();
            await session.startOrJoin(container, {
                chatId: direct,
                callType: "default",
                join: false,
            });

            shell.onEvent?.({
                json: JSON.stringify({
                    kind: "participant-left",
                    participant: { ...me, sessionId: "them", local: false },
                    present: 1,
                }),
            });

            expect(client.endVideoCall).toHaveBeenCalledWith(direct, 7n);
            expect(shell.invoke).toHaveBeenCalledWith("plugin:oc|native_call_leave");
        });
    });
});
