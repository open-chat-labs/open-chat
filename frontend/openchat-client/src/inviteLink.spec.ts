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

import { ErrorCode, anonymousUser, type GroupChatSummary, type WorkerRequest } from "@shared";
import type { OpenChatConfig } from "./config";
import { OpenChat } from "./openchat";
import { currentUserStore } from "./state";
import { inviteLinkUrl } from "./utils/inviteLink";
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
    } as unknown as OpenChatConfig;
}

const groupId = { kind: "group_chat" as const, groupId: "bbbbb-bb" };
const privateGroup = { kind: "group_chat", id: groupId, public: false } as GroupChatSummary;

describe("invite links", () => {
    let client: OpenChat;

    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        currentUserStore.set({ ...anonymousUser(), userId: "me" });
        client = new OpenChat(config());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        currentUserStore.set(anonymousUser());
    });

    test("a private group's link carries its code so it works, a public one's has none", () => {
        expect(
            inviteLinkUrl("https://oc.app", groupId, "me", { kind: "enabled", code: "1234" }),
        ).toBe("https://oc.app/chats/group/bbbbb-bb/?ref=me&code=1234");
        expect(inviteLinkUrl("https://oc.app", groupId, "me", { kind: "public" })).toBe(
            "https://oc.app/chats/group/bbbbb-bb/?ref=me",
        );
        expect(
            inviteLinkUrl("https://oc.app", groupId, "me", { kind: "disabled" }),
        ).toBeUndefined();
    });

    test("a public group has no invite code to fetch, so nothing is sent", async () => {
        const send = vi
            .spyOn(WorkerAgent.prototype, "send")
            .mockResolvedValue({ kind: "success", code: "1234" } as never);

        expect(await client.getInviteLink({ ...privateGroup, public: true })).toEqual({
            kind: "public",
        });
        expect(send).not.toHaveBeenCalled();
    });

    test("a failed disable says why instead of reporting the link disabled", async () => {
        vi.spyOn(WorkerAgent.prototype, "send").mockImplementation(((req: WorkerRequest) =>
            Promise.resolve(
                req.kind === "disableInviteCode"
                    ? { kind: "error", code: ErrorCode.InitiatorNotAuthorized, message: undefined }
                    : new Promise(() => {}),
            )) as never);

        expect(await client.setInviteLinkEnabled(privateGroup, false)).toEqual({
            kind: "failed",
            message: expect.objectContaining({ key: "invite.errorDisablingLink" }),
        });
    });
});
