import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// A store the client builds at import time reads the screen width through
// matchMedia, which jsdom does not provide
vi.hoisted(() => {
    window.matchMedia = ((query: string) =>
        ({
            matches: false,
            media: query,
            addEventListener: () => {},
            removeEventListener: () => {},
            addListener: () => {},
            removeListener: () => {},
            onchange: null,
            dispatchEvent: () => false,
        }) as unknown as MediaQueryList) as typeof window.matchMedia;
});

// The constructor starts an auth client against IndexedDB; keep it inert
vi.mock("@icp-sdk/auth/client", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    AuthClient: { create: () => new Promise(() => {}) },
}));

import {
    ChatMap,
    anonymousUser,
    type ChatIdentifier,
    type DirectChatSummary,
    type GroupChatSummary,
    type VideoCallRoom,
    type WorkerRequest,
} from "@shared";
import type { OpenChatConfig } from "./config";
import { OpenChat } from "./openchat";
import { currentUserStore, serverDirectChatsStore, serverGroupChatsStore } from "./state";
import { rtcConnectionsManager } from "./utils/rtcConnectionsManager";
import { WorkerAgent } from "./workerAgent";

class FakeWorker {
    onmessage: ((ev: MessageEvent) => void) | undefined;
    postMessage() {}
    addEventListener() {}
}

function config(): OpenChatConfig {
    return {
        mobileLayout: "v1",
        websiteVersion: "test",
        logger: { error: vi.fn(), debug: vi.fn(), warn: vi.fn(), log: vi.fn() },
        proposalBotCanister: "aaaaa-aa",
        videoBridgeUrl: "https://bridge",
        i18nFormatter: (key: string) => key,
    } as unknown as OpenChatConfig;
}

const direct: ChatIdentifier = { kind: "direct_chat", userId: "them" };
const group: ChatIdentifier = { kind: "group_chat", groupId: "rrkah-fqaaa-aaaaa-aaaaq-cai" };

describe("starting or joining a call", () => {
    let client: OpenChat;
    let sent: WorkerRequest[];
    // what the bridge says when asked for the room
    let bridge: Response;
    const enterRoom = vi.fn(async (_: VideoCallRoom) => {});

    function bridgeRoom(joining: boolean): Response {
        return new Response(JSON.stringify({ token: "t", roomName: "r", messageId: "7", joining }));
    }

    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => bridge),
        );
        currentUserStore.set({ ...anonymousUser(), userId: "me", username: "me" });
        const directs = new ChatMap<DirectChatSummary>();
        directs.set(direct, {
            kind: "direct_chat",
            id: direct,
            them: direct,
        } as unknown as DirectChatSummary);
        serverDirectChatsStore.set(directs);
        const groups = new ChatMap<GroupChatSummary>();
        groups.set(group, {
            kind: "group_chat",
            id: group,
            localUserIndex: "lui",
        } as unknown as GroupChatSummary);
        serverGroupChatsStore.set(groups);
        client = new OpenChat(config());
        sent = [];
        bridge = bridgeRoom(false);
        vi.spyOn(WorkerAgent.prototype, "send").mockImplementation((async (req: WorkerRequest) => {
            sent.push(req);
            switch (req.kind) {
                case "getAccessToken":
                    return "jwt";
                case "getLocalUserIndexForUser":
                    return "lui";
                default:
                    return { kind: "success" };
            }
        }) as never);
        vi.spyOn(rtcConnectionsManager, "create").mockResolvedValue(true as never);
        vi.spyOn(rtcConnectionsManager, "sendMessage").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        enterRoom.mockReset();
        currentUserStore.set(anonymousUser());
        serverDirectChatsStore.set(new ChatMap());
        serverGroupChatsStore.set(new ChatMap());
    });

    const rang = () =>
        vi
            .mocked(rtcConnectionsManager.sendMessage)
            .mock.calls.some(([, msg]) => msg.kind === "remote_video_call_started");
    const recorded = () =>
        sent.filter((r) => r.kind === "joinVideoCall" || r.kind === "setVideoCallPresence");

    // Invariant: a new call rings the chat's other users; joining one that is already running
    // rings nobody again
    test("starting a call rings the other user, joining one does not", async () => {
        await client.startOrJoinVideoCall(direct, "default", false, enterRoom);
        await vi.waitFor(() => expect(rang()).toBe(true));

        vi.mocked(rtcConnectionsManager.sendMessage).mockClear();
        bridge = bridgeRoom(true);
        await client.startOrJoinVideoCall(direct, "default", true, enterRoom);
        await new Promise((resolve) => setTimeout(resolve));
        expect(rang()).toBe(false);
    });

    // Invariant: a user who joins a running call is recorded as in it, once they are in its
    // room; a user who starts one is recorded by the start itself
    test("joining a direct call records the join after entering the room", async () => {
        bridge = bridgeRoom(true);
        enterRoom.mockImplementation(async () => {
            expect(recorded()).toEqual([]);
        });

        expect(await client.startOrJoinVideoCall(direct, "default", true, enterRoom)).toEqual({
            kind: "joined",
        });
        expect(enterRoom).toHaveBeenCalledWith(
            expect.objectContaining({ token: "t", roomName: "r", messageId: 7n, joining: true }),
        );
        expect(recorded()).toMatchObject([
            { kind: "joinVideoCall", chatId: direct, messageId: 7n },
        ]);

        sent = [];
        bridge = bridgeRoom(false);
        await client.startOrJoinVideoCall(direct, "default", false, enterRoom);
        expect(recorded()).toEqual([]);
    });

    // Invariant: a broadcast's audience joins hidden, so it is not on stage; anyone joining any
    // other group call joins on stage
    test("a broadcast's audience joins hidden", async () => {
        bridge = bridgeRoom(true);
        await client.startOrJoinVideoCall(group, "broadcast", true, enterRoom);
        bridge = bridgeRoom(true);
        await client.startOrJoinVideoCall(group, "default", true, enterRoom);

        expect(recorded()).toMatchObject([
            { kind: "setVideoCallPresence", presence: "hidden" },
            { kind: "setVideoCallPresence", presence: "default" },
        ]);
    });

    test("a call that has ended is reported as no meeting and its room is not entered", async () => {
        bridge = new Response(null, { status: 400 });

        expect(await client.startOrJoinVideoCall(group, "default", true, enterRoom)).toEqual({
            kind: "no_meeting",
        });
        expect(enterRoom).not.toHaveBeenCalled();
    });

    // Invariant: a call the user could not get into says why and does not record them as in it
    test("a call whose room can't be entered says why and records no join", async () => {
        bridge = bridgeRoom(true);
        enterRoom.mockRejectedValue(new Error("daily failed"));

        expect(await client.startOrJoinVideoCall(direct, "default", true, enterRoom)).toEqual({
            kind: "failed",
            message: expect.objectContaining({ key: "videoCall.callFailed" }),
        });
        expect(recorded()).toEqual([]);
    });

    // Invariant: nobody is rung for a call the caller never got into
    test("a new call whose room can't be entered rings nobody", async () => {
        enterRoom.mockRejectedValue(new Error("daily failed"));

        await client.startOrJoinVideoCall(direct, "default", false, enterRoom);
        await new Promise((resolve) => setTimeout(resolve));

        expect(rang()).toBe(false);
    });
});
