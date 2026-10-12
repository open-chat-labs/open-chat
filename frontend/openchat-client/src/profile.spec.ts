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

import { ErrorCode, anonymousUser, type PublicProfile, type WorkerRequest } from "@shared";
import type { OpenChatConfig } from "./config";
import { OpenChat } from "./openchat";
import { currentUserStore } from "./state";
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

const original: PublicProfile = {
    username: "julian",
    displayName: "Julian",
    bio: "old bio",
    isPremium: false,
    phoneIsVerified: false,
    created: 0n,
};

describe("saving the user's profile", () => {
    let client: OpenChat;
    let sent: WorkerRequest[];
    let responses: Partial<Record<WorkerRequest["kind"], unknown>>;

    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        currentUserStore.set({ ...anonymousUser(), userId: "me" });
        client = new OpenChat(config());
        sent = [];
        responses = {
            setUsername: "success",
            setDisplayName: "success",
            setBio: { kind: "success" },
        };
        vi.spyOn(WorkerAgent.prototype, "send").mockImplementation(((req: WorkerRequest) => {
            sent.push(req);
            return req.kind in responses
                ? Promise.resolve(responses[req.kind])
                : new Promise(() => {});
        }) as never);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        currentUserStore.set(anonymousUser());
    });

    test("only the fields the user changed are sent", async () => {
        await client.saveProfile(original, { ...original, bio: "new bio" });

        expect(sent).toEqual([{ kind: "setBio", bio: "new bio" }]);
    });

    test("a rejected field keeps its unsaved value and says why, while the other fields save", async () => {
        responses.setUsername = "username_taken";

        const outcome = await client.saveProfile(original, {
            ...original,
            username: "taken",
            bio: "new bio",
        });

        expect(outcome).toEqual({
            profile: { ...original, bio: "new bio" },
            errors: { username: "register.usernameTaken" },
        });
    });

    test("a field that fails for a reason the user can't fix is not treated as saved and reports a failure", async () => {
        responses.setBio = {
            kind: "error",
            code: ErrorCode.InitiatorSuspended,
            message: undefined,
        };

        const outcome = await client.saveProfile(original, { ...original, bio: "new bio" });

        expect(outcome.profile).toEqual(original);
        expect(outcome.failure).toBeDefined();
    });
});
