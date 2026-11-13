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

import { anonymousUser, emptyRules, type GroupChatIdentifier, type WorkerRequest } from "@shared";
import type { OpenChatConfig } from "./config";
import { OpenChat } from "./openchat";
import {
    currentUserStore,
    localUpdates,
    routeStore,
    selectedChatIdStore,
    selectedChatInvitedUsersStore,
} from "./state";
import { ChatDetailsState } from "./state/chat/serverDetails";
import { currentChatVisit, startChatVisit } from "./state/selectedChat";
import { WorkerAgent } from "./workerAgent";

// The people invited to a group are its Pending (the native Invite people screen's) as soon as the
// invite is sent: the client adds them to the selected chat's invited users before the backend
// answers, and takes them out again if it refuses.

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
    } as unknown as OpenChatConfig;
}

const groupId: GroupChatIdentifier = { kind: "group_chat", groupId: "bbbbb-bb" };

function selectGroup(invited: string[]) {
    routeStore.set({
        kind: "global_chat_selected_route",
        chatId: groupId,
        chatType: "group_chat",
        open: false,
        scope: { kind: "chats" },
    });
    startChatVisit(selectedChatIdStore.value);
    currentChatVisit()?.setDetails(
        new ChatDetailsState(
            groupId,
            0n,
            new Map(),
            new Set(),
            new Set(),
            new Set(invited),
            new Set(),
            new Map(),
            new Map(),
            emptyRules(),
        ),
    );
}

describe("inviting people to a group", () => {
    let client: OpenChat;

    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        currentUserStore.set({ ...anonymousUser(), userId: "me", username: "julian" });
        localUpdates.clearAll();
        client = new OpenChat(config());
        selectGroup(["a"]);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        localUpdates.clearAll();
        currentUserStore.set(anonymousUser());
    });

    // The inviter's username goes with the invite so the LocalUserIndex can name them in its push
    test("they're among the invited at once, and stay once the backend has them", async () => {
        let answer: (ok: boolean) => void = () => {};
        const send = vi
            .spyOn(WorkerAgent.prototype, "send")
            .mockImplementation(((req: WorkerRequest) =>
                req.kind === "inviteUsers"
                    ? new Promise<boolean>((resolve) => (answer = resolve))
                    : new Promise(() => {})) as never);

        const invited = client.inviteUsers(groupId, ["b", "c"]);

        expect(send).toHaveBeenCalledWith(
            expect.objectContaining({
                kind: "inviteUsers",
                id: groupId,
                userIds: ["b", "c"],
                callerUsername: "julian",
            }),
        );
        expect([...selectedChatInvitedUsersStore.value].sort()).toEqual(["a", "b", "c"]);

        answer(true);
        expect(await invited).toBe(true);
        expect([...selectedChatInvitedUsersStore.value].sort()).toEqual(["a", "b", "c"]);
    });

    test("they're taken out again if the backend refuses", async () => {
        vi.spyOn(WorkerAgent.prototype, "send").mockImplementation(((req: WorkerRequest) =>
            req.kind === "inviteUsers" ? Promise.resolve(false) : new Promise(() => {})) as never);

        expect(await client.inviteUsers(groupId, ["b"])).toBe(false);
        expect([...selectedChatInvitedUsersStore.value]).toEqual(["a"]);
    });
});
