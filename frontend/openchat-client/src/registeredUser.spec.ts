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

// The auth client keeps its keys in IndexedDB, which jsdom doesn't have
vi.mock("@icp-sdk/auth/client", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    AuthClient: { create: async () => ({}) },
}));

import { IdentityStorage } from "@shared";
import type { OpenChatConfig } from "./config";
import { OpenChat } from "./openchat";
import { chatsInitialisedStore, identityStateStore } from "./state";
import { createdUser } from "./utils/signUp";

// What the client asks the worker for, by kind
const posted: { kind: string; initialLoad?: boolean }[] = [];

class FakeWorker {
    onmessage: ((ev: MessageEvent) => void) | undefined;
    postMessage(msg: { kind: string; initialLoad?: boolean }) {
        posted.push(msg);
    }
    addEventListener() {}
}

function config(): OpenChatConfig {
    return {
        mobileLayout: "v1",
        websiteVersion: "test",
        logger: { error: vi.fn(), debug: vi.fn(), warn: vi.fn(), log: vi.fn() },
        proposalBotCanister: "aaaaa-aa",
        webAuthnOrigin: "oc.app",
    } as unknown as OpenChatConfig;
}

const updates = () => posted.filter((m) => m.kind === "getUpdates");

describe("a new account", () => {
    let client: OpenChat;

    beforeEach(async () => {
        vi.stubGlobal("Worker", FakeWorker);
        vi.spyOn(IdentityStorage.prototype, "getKeyAndChain").mockResolvedValue(undefined);
        client = new OpenChat(config());
        await new Promise((r) => setTimeout(r, 0));
        posted.length = 0;
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        identityStateStore.set({ kind: "anon" });
        chatsInitialisedStore.set(false);
    });

    /** An identity without an account runs as the anonymous user, whose chats loaded as such.
     * The account's own chats (the OpenChat Bot's welcome DM) need an initial load of their own,
     * or they only show after a reload. */
    test("loads its chats afresh, not as a later load of the anonymous session's", async () => {
        identityStateStore.set({ kind: "registering" });
        chatsInitialisedStore.set(true);

        client.onRegisteredUser(
            createdUser("newperson", { kind: "success", userId: "u1", icpAccount: "acc" }),
        );
        await new Promise((r) => setTimeout(r, 0));

        expect(chatsInitialisedStore.value).toBe(false);
        expect(identityStateStore.value.kind).toBe("logged_in");
        expect(updates().length).toBeGreaterThan(0);
        expect(updates().every((m) => m.initialLoad === true)).toBe(true);
    });
});
