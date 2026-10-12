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
    CommunityMap,
    ROLE_MEMBER,
    ROLE_NONE,
    anonymousUser,
    type AccessGate,
    type CommunitySummary,
    type GroupChatSummary,
    type WorkerRequest,
} from "@shared";
import type { OpenChatConfig } from "./config";
import { OpenChat } from "./openchat";
import {
    currentUserStore,
    identityStateStore,
    serverCommunitiesStore,
    serverGroupChatsStore,
} from "./state";
import { postLoginJoin } from "./utils/join";
import { WorkerAgent } from "./workerAgent";

class FakeWorker {
    onmessage: ((ev: MessageEvent) => void) | undefined;
    postMessage() {}
    addEventListener() {}
}

const chatId = { kind: "group_chat" as const, groupId: "bbbbb-bb" };
const communityId = { kind: "community" as const, communityId: "ccccc-cc" };
const ledger = "ryjl3-tyaaa-aaaaa-aaaba-cai";
const paymentGate: AccessGate = {
    kind: "payment_gate",
    ledgerCanister: ledger,
    amount: 100_000n,
    fee: 10_000n,
};

function group(
    role: typeof ROLE_MEMBER | typeof ROLE_NONE,
    gate: AccessGate = { kind: "no_gate" },
): GroupChatSummary {
    return {
        kind: "group_chat",
        id: chatId,
        name: "g",
        level: "group",
        public: true,
        membership: { role, archived: false, lapsed: false },
        gateConfig: { gate, expiry: undefined },
        isInvited: false,
    } as unknown as GroupChatSummary;
}

function community(
    role: typeof ROLE_MEMBER | typeof ROLE_NONE,
    gate: AccessGate = { kind: "no_gate" },
): CommunitySummary {
    return {
        kind: "community",
        id: communityId,
        name: "c",
        level: "community",
        membership: { role, archived: false, lapsed: false },
        gateConfig: { gate, expiry: undefined },
        isInvited: false,
        channels: [],
    } as unknown as CommunitySummary;
}

function config(): OpenChatConfig {
    return {
        mobileLayout: "v1",
        websiteVersion: "test",
        logger: { error: vi.fn(), debug: vi.fn(), warn: vi.fn(), log: vi.fn() },
        proposalBotCanister: "aaaaa-aa",
    } as unknown as OpenChatConfig;
}

describe("joining a group or community", () => {
    let client: OpenChat;
    let sent: WorkerRequest[];

    function joinRequests() {
        return sent.filter((r) => r.kind === "joinGroup" || r.kind === "joinCommunity");
    }

    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        currentUserStore.set({ ...anonymousUser(), userId: "me" });
        client = new OpenChat(config());
        sent = [];
        vi.spyOn(WorkerAgent.prototype, "send").mockImplementation(((req: WorkerRequest) => {
            sent.push(req);
            switch (req.kind) {
                case "joinGroup":
                case "joinCommunity":
                case "approveAccessGatePayment":
                    return Promise.resolve({ kind: "error", code: 0 });
                default:
                    return new Promise(() => {});
            }
        }) as never);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        currentUserStore.set(anonymousUser());
        serverGroupChatsStore.set(new ChatMap<GroupChatSummary>());
        serverCommunitiesStore.set(new CommunityMap<CommunitySummary>());
        identityStateStore.set({ kind: "loading_user", registering: false });
    });

    // Invariant 1: an anonymous user's join never calls the backend; it is recorded for after login
    test("an anonymous user's join is recorded for after login, not sent", async () => {
        currentUserStore.set(anonymousUser());
        const g = group(ROLE_NONE);

        expect(await client.joinGroup(g)).toEqual({ kind: "skipped" });

        expect(sent).toEqual([]);
        const state = identityStateStore.value;
        expect(state.postLogin).toEqual({ kind: "join_group", group: g });
        expect(postLoginJoin(state, true)).toBeUndefined();
        expect(postLoginJoin({ ...state, kind: "logged_in" }, false)).toBeUndefined();
        expect(postLoginJoin({ ...state, kind: "logged_in" }, true)).toEqual(state.postLogin);
    });

    // Invariant 1: an anonymous user's join never calls the backend; it is recorded for after login
    test("an anonymous user's community join is recorded for after login, not sent", async () => {
        currentUserStore.set(anonymousUser());
        const c = community(ROLE_NONE);

        expect(await client.joinCommunity(c)).toEqual({ kind: "skipped" });

        expect(sent).toEqual([]);
        const state = identityStateStore.value;
        expect(state.postLogin).toEqual({ kind: "join_community", community: c });
        expect(postLoginJoin({ ...state, kind: "logged_in" }, false)).toBeUndefined();
        expect(postLoginJoin({ ...state, kind: "logged_in" }, true)).toEqual(state.postLogin);
    });

    // Invariant 2: no join request for a group the user is already a non-lapsed member of
    test("a member's join is not sent", async () => {
        const g = group(ROLE_MEMBER);
        serverGroupChatsStore.set(new ChatMap<GroupChatSummary>().set(g.id, g));

        expect(await client.joinGroup(g)).toEqual({ kind: "skipped" });

        expect(joinRequests()).toEqual([]);
    });

    // Invariant 2: a lapsed member is not a member, whichever chat list is showing
    test("a lapsed member's join is sent", async () => {
        const g = group(ROLE_MEMBER);
        g.membership.lapsed = true;
        serverGroupChatsStore.set(new ChatMap<GroupChatSummary>().set(g.id, g));

        await client.joinGroup(g);

        expect(joinRequests()).toHaveLength(1);
    });

    // Invariant 3: gates needing evaluation are evaluated before any join request
    test("a gate that needs evaluating stops the join before anything is sent", async () => {
        const g = group(ROLE_NONE, paymentGate);

        const outcome = await client.joinGroup(g);

        expect(outcome.kind).toBe("needs_gate_evaluation");
        expect(sent).toEqual([]);
    });

    // Invariant 3: the join sends exactly the payment approvals the user produced
    test("the payment the user approved is the one sent", async () => {
        const g = group(ROLE_NONE, paymentGate);
        vi.mocked(WorkerAgent.prototype.send).mockImplementation(((req: WorkerRequest) => {
            sent.push(req);
            return Promise.resolve({ kind: "success" });
        }) as never);

        await client.joinGroup(g, {
            credentials: [],
            paymentApprovals: new Map([[ledger, { amount: 100_000n, approvalFee: 10_000n }]]),
            compositeGateIndex: 1,
        });

        expect(sent.map((r) => r.kind)).toEqual(["approveAccessGatePayment", "joinGroup"]);
        expect(sent[0]).toMatchObject({ ledger, canisterId: chatId.groupId, amount: 90_000n });
        expect(sent[1]).toMatchObject({ compositeGateIndex: 1 });
    });

    // Invariant 2: no join request for a community the user is already a non-lapsed member of
    test("a community member's join is not sent", async () => {
        // the join replayed after login carries the community as it was before login
        serverCommunitiesStore.set(CommunityMap.fromList([community(ROLE_MEMBER)]));

        expect(await client.joinCommunity(community(ROLE_NONE))).toEqual({ kind: "skipped" });

        expect(joinRequests()).toEqual([]);
    });

    // Invariant 2: a lapsed member is not a member
    test("a lapsed community member's join is sent", async () => {
        const c = community(ROLE_MEMBER);
        c.membership.lapsed = true;
        serverCommunitiesStore.set(CommunityMap.fromList([c]));

        await client.joinCommunity(c);

        expect(joinRequests()).toHaveLength(1);
    });

    // Invariant 3: gates needing evaluation are evaluated before any join request
    test("a community gate that needs evaluating stops the join before anything is sent", async () => {
        const outcome = await client.joinCommunity(community(ROLE_NONE, paymentGate));

        expect(outcome.kind).toBe("needs_gate_evaluation");
        expect(sent).toEqual([]);
    });

    // Invariant 3: the join sends exactly the payment approvals the user produced
    test("the community payment the user approved is the one sent", async () => {
        vi.mocked(WorkerAgent.prototype.send).mockImplementation(((req: WorkerRequest) => {
            sent.push(req);
            return Promise.resolve({ kind: "success" });
        }) as never);

        await client.joinCommunity(community(ROLE_NONE, paymentGate), {
            credentials: [],
            paymentApprovals: new Map([[ledger, { amount: 100_000n, approvalFee: 10_000n }]]),
            compositeGateIndex: 1,
        });

        expect(sent.map((r) => r.kind)).toEqual(["approveAccessGatePayment", "joinCommunity"]);
        expect(sent[0]).toMatchObject({
            ledger,
            canisterId: communityId.communityId,
            amount: 90_000n,
        });
        expect(sent[1]).toMatchObject({ compositeGateIndex: 1 });
    });

    test("a failed community join carries a message to show", async () => {
        const outcome = await client.joinCommunity(community(ROLE_NONE));

        expect(outcome).toMatchObject({
            kind: "failed",
            message: { key: "communities.errors.joinFailed" },
        });
        expect(joinRequests()).toHaveLength(1);
    });

    // Invariant 4: a gate check the client can't explain still tells the user the join failed
    test("a failed gate check with no gates the client knows of carries a message", async () => {
        vi.mocked(WorkerAgent.prototype.send).mockImplementation(((req: WorkerRequest) => {
            sent.push(req);
            return Promise.resolve({ kind: "gate_check_failed" });
        }) as never);

        expect(await client.joinGroup(group(ROLE_NONE))).toMatchObject({ kind: "failed" });
        expect(await client.joinCommunity(community(ROLE_NONE))).toMatchObject({
            kind: "failed",
        });
    });

    test("a failed join carries a message to show", async () => {
        const outcome = await client.joinGroup(group(ROLE_NONE));

        expect(outcome).toMatchObject({ kind: "failed", message: { key: "joinGroupFailed" } });
        expect(joinRequests()).toHaveLength(1);
    });
});
