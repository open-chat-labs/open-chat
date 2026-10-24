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

import { ErrorCode, anonymousUser, type UserGroupDetails, type WorkerRequest } from "@shared";
import type { OpenChatConfig } from "./config";
import { OpenChat } from "./openchat";
import { currentUserStore } from "./state";
import { userGroupSaveOutcome } from "./utils/userGroups";
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

const community = { kind: "community" as const, communityId: "qhbym-qaaaa-aaaaa-aaafq-cai" };

describe("saving a user group", () => {
    let client: OpenChat;
    let sent: WorkerRequest[];

    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        currentUserStore.set({ ...anonymousUser(), userId: "me" });
        client = new OpenChat(config());
        sent = [];
        vi.spyOn(WorkerAgent.prototype, "send").mockImplementation(((req: WorkerRequest) => {
            sent.push(req);
            return req.kind === "createUserGroup" || req.kind === "updateUserGroup"
                ? Promise.resolve({ kind: "success", userGroupId: 7 })
                : new Promise(() => {});
        }) as never);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        currentUserStore.set(anonymousUser());
    });

    // 4b invariant 5: a user group edit sends exactly the members added and removed, and never
    // changes the store's member set
    test("an edit sends only the members added and removed, and leaves the group's set alone", async () => {
        const original: UserGroupDetails = {
            kind: "user_group",
            id: 3,
            name: "devs",
            members: new Set(["a", "b", "c"]),
        };

        const outcome = await client.saveUserGroup(community, original, "devs", ["b", "c", "d"]);

        expect(outcome).toEqual({ kind: "success" });
        expect(sent).toEqual([
            expect.objectContaining({
                kind: "updateUserGroup",
                userGroupId: 3,
                usersToAdd: ["d"],
                usersToRemove: ["a"],
            }),
        ]);
        expect([...original.members]).toEqual(["a", "b", "c"]);
    });

    test("a new group is created with the members picked", async () => {
        await client.saveUserGroup(community, undefined, "devs", ["a", "b"]);

        expect(sent).toEqual([
            expect.objectContaining({ kind: "createUserGroup", name: "devs", userIds: ["a", "b"] }),
        ]);
    });
});

describe("user group save outcome", () => {
    // 4b invariant 3: a failed user group save maps to a message; name taken and the member
    // limit get their own
    test("maps each failure to its message", () => {
        const error = (code: number, message?: string) =>
            userGroupSaveOutcome({ kind: "error", code, message }, false);

        expect(error(ErrorCode.NameTaken)).toEqual({
            kind: "failed",
            message: expect.objectContaining({ key: "communities.errors.userGroupNameTaken" }),
        });
        expect(error(ErrorCode.TooManyUsers, "1000")).toEqual({
            kind: "failed",
            message: expect.objectContaining({
                key: "communities.errors.userGroupTooManyMembers",
                params: { max: "1000" },
            }),
        });
        expect(userGroupSaveOutcome({ kind: "failure" }, true)).toEqual({
            kind: "failed",
            message: expect.objectContaining({ key: "communities.errors.createGroupFailed" }),
        });
        expect(userGroupSaveOutcome({ kind: "offline" }, false)).toEqual({
            kind: "failed",
            message: expect.objectContaining({ key: "communities.errors.updateGroupFailed" }),
        });
    });
});
