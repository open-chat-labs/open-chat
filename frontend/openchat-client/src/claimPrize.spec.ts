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

import type { WorkerRequest } from "@shared";
import type { OpenChatConfig } from "./config";
import { OpenChat } from "./openchat";
import { WorkerAgent } from "./workerAgent";

class FakeWorker {
    onmessage: ((ev: MessageEvent) => void) | undefined;
    postMessage() {}
    addEventListener() {}
}

const chatId = { kind: "group_chat" as const, groupId: "rrkah-fqaaa-aaaaa-aaaaq-cai" };

describe("claiming a prize", () => {
    let client: OpenChat;
    let sent: WorkerRequest[];

    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        client = new OpenChat({
            mobileLayout: "v1",
            websiteVersion: "test",
            logger: { error: vi.fn(), debug: vi.fn(), warn: vi.fn(), log: vi.fn() },
            proposalBotCanister: "aaaaa-aa",
        } as unknown as OpenChatConfig);
        sent = [];
        vi.spyOn(WorkerAgent.prototype, "send").mockImplementation(((req: WorkerRequest) => {
            sent.push(req);
            return Promise.resolve({ kind: "success" });
        }) as never);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    // 5a invariant 2: a prize claim is sent only from a trusted click
    test("a script's click claims nothing", async () => {
        expect(await client.claimPrize(chatId, 1n, new MouseEvent("click"), undefined)).toBe(false);
        expect(sent.filter((r) => r.kind === "claimPrize")).toEqual([]);
    });
});
