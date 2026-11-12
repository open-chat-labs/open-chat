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

import { IdentityStorage, type JoinGroup, type MultiUserChat } from "@shared";
import type { OpenChatConfig } from "./config";
import { OpenChat } from "./openchat";
import {
    chatsInitialisedStore,
    chatsLoadedForUserStore,
    currentUserChatsLoadedStore,
    identityStateStore,
} from "./state";
import { createdUser } from "./utils/signUp";

// What the client asks the worker for, by kind
type Request = { kind: string; correlationId: number; initialLoad?: boolean };
const posted: Request[] = [];

// The anonymous session's chats as the worker sends them: a snapshot every pass, which seeds the
// sync cursor for that session. The fold stops at once at a suspension change, so the spec needn't
// answer what a full fold asks the worker for.
const anonymousSnapshot = {
    userId: "anon",
    version: 0,
    updates: { suspensionChanged: false },
};

class FakeWorker {
    onmessage: ((ev: MessageEvent) => void) | undefined;
    constructor() {
        answer = (msg, response) => this.answer(msg, response);
    }
    postMessage(msg: Request) {
        posted.push(msg);
        // the anonymous identity, set (nothing to say about it), and its chats
        if (msg.kind === "setAuthIdentity") this.answer(msg, undefined);
        if (msg.kind === "getUpdates" && answering) this.answer(msg, anonymousSnapshot);
    }
    answer(msg: Request, response: unknown) {
        const data = {
            kind: "worker_response",
            requestKind: msg.kind,
            correlationId: msg.correlationId,
            response,
            final: true,
        };
        void Promise.resolve().then(() => this.onmessage?.({ data } as MessageEvent));
    }
    addEventListener() {}
}

// whether the worker answers getUpdates by itself: only the anonymous session's
let answering = true;
// the worker's answer to a request it left unanswered
let answer: ((msg: Request, response: unknown) => void) | undefined;

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
        // The client starts pollers (chats, bots, users, balances …) on real timers otherwise,
        // which would keep firing after the spec
        vi.useFakeTimers();
        vi.stubGlobal("Worker", FakeWorker);
        vi.spyOn(IdentityStorage.prototype, "getKeyAndChain").mockResolvedValue(undefined);
        answering = true;
        client = new OpenChat(config());
        // the anonymous session's first pass, folded
        await vi.advanceTimersByTimeAsync(0);
        expect(updates().length).toBeGreaterThan(0);
        posted.length = 0;
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        identityStateStore.set({ kind: "anon" });
        chatsInitialisedStore.set(false);
        chatsLoadedForUserStore.set(undefined);
    });

    /** An identity without an account runs as the anonymous user, whose chats loaded as such.
     * The account's own chats (the OpenChat Bot's welcome DM) need an initial load of their own,
     * or they only show after a reload. They keep counting as loaded meanwhile: the trees put up
     * their loader otherwise, which takes down the sign-up still finishing under it. */
    test("loads its chats afresh, without counting them as unloaded meanwhile", async () => {
        // as the anonymous session leaves them: its chats in, the account being made
        chatsInitialisedStore.set(true);
        identityStateStore.set({ kind: "registering" });
        answering = false;
        const unloaded = vi.fn();
        const unsubscribe = chatsInitialisedStore.subscribe((loaded) => {
            if (!loaded) unloaded();
        });

        client.onRegisteredUser(
            createdUser("newperson", { kind: "success", userId: "u1", icpAccount: "acc" }),
        );
        await vi.advanceTimersByTimeAsync(0);
        unsubscribe();

        expect(unloaded).not.toHaveBeenCalled();
        expect(identityStateStore.value.kind).toBe("logged_in");
        expect(updates().length).toBeGreaterThan(0);
        expect(updates().every((m) => m.initialLoad === true)).toBe(true);
    });

    /** A guest who asked to join a group and then made an account joins it once the account's own
     * chats are in. Decided against the anonymous session's, which stand in until then, the join
     * would be undone by the account's initial load folding in after it. */
    test("hands out a guest's join only once the account's own chats have loaded", async () => {
        const join: JoinGroup = {
            kind: "join_group",
            group: { id: { kind: "group_chat", groupId: "g1" } } as unknown as MultiUserChat,
        };
        chatsInitialisedStore.set(true);
        identityStateStore.set({ kind: "registering", postLogin: join });
        answering = false;

        client.onRegisteredUser(
            createdUser("newperson", { kind: "success", userId: "u1", icpAccount: "acc" }),
        );
        await vi.advanceTimersByTimeAsync(0);

        // signed in, the anonymous session's chats still standing in: not yet
        expect(identityStateStore.value.kind).toBe("logged_in");
        expect(chatsInitialisedStore.value).toBe(true);
        expect(currentUserChatsLoadedStore.value).toBe(false);
        expect(client.takePostLoginJoin()).toBeUndefined();
        expect(identityStateStore.value.postLogin).toEqual(join);

        // the account's initial load folds in
        const load = updates().find((m) => m.initialLoad === true);
        if (load === undefined || answer === undefined) throw new Error("no initial load asked");
        answer(load, { ...anonymousSnapshot, userId: "u1" });
        await vi.advanceTimersByTimeAsync(0);

        expect(currentUserChatsLoadedStore.value).toBe(true);
        expect(client.takePostLoginJoin()).toEqual(join);
        // handed out once
        expect(client.takePostLoginJoin()).toBeUndefined();
    });
});
