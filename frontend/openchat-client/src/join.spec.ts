import { afterEach, beforeEach, describe, expect, test, vi, type MockInstance } from "vitest";

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
    chatsInitialisedStore,
    currentUserStore,
    identityStateStore,
    serverCommunitiesStore,
    serverGroupChatsStore,
} from "./state";
import { communityPreviewOriginStore } from "./stores/previewOrigin";
import { localUpdates } from "./state/localUpdates";
import { paymentGateSplit } from "./utils/accessGates";
import { postLoginJoin } from "./utils/join";
import { MiniAppService } from "./utils/miniAppService";
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

    // an approval made for a join that then failed stands for a few minutes: trying again doesn't
    // approve the payment (and pay the approval fee) again, until it's about to expire
    test("trying a failed join again doesn't approve its payment again while the approval stands", async () => {
        const g = group(ROLE_NONE, paymentGate);
        vi.mocked(WorkerAgent.prototype.send).mockImplementation(((req: WorkerRequest) => {
            sent.push(req);
            return Promise.resolve(
                req.kind === "joinGroup" ? { kind: "error", code: 0 } : { kind: "success" },
            );
        }) as never);
        const gateCheck = {
            credentials: [],
            paymentApprovals: new Map([[ledger, { amount: 100_000n, approvalFee: 10_000n }]]),
            compositeGateIndex: undefined,
        };
        const kinds = () => sent.splice(0).map((r) => r.kind);

        expect((await client.joinGroup(g, gateCheck)).kind).toBe("failed");
        expect(kinds()).toEqual(["approveAccessGatePayment", "joinGroup"]);
        await client.joinGroup(g, gateCheck);
        expect(kinds()).toEqual(["joinGroup"]);

        // four and a half minutes on, too little is left for the join: approved again
        const now = Date.now();
        vi.spyOn(Date, "now").mockReturnValue(now + 4.5 * 60_000);
        await client.joinGroup(g, gateCheck);
        expect(kinds()).toEqual(["approveAccessGatePayment", "joinGroup"]);
    });

    // an approval replaces the allowance on its ledger: after approving another amount (another
    // branch of an "any" gate, the community alone), the first one doesn't stand any more
    test("an approval of another amount on the same ledger replaces the one standing", async () => {
        const g = group(ROLE_NONE, paymentGate);
        vi.mocked(WorkerAgent.prototype.send).mockImplementation(((req: WorkerRequest) => {
            sent.push(req);
            return Promise.resolve(
                req.kind === "joinGroup" ? { kind: "error", code: 0 } : { kind: "success" },
            );
        }) as never);
        const paying = (amount: bigint) => ({
            credentials: [],
            paymentApprovals: new Map([[ledger, { amount, approvalFee: 10_000n }]]),
            compositeGateIndex: undefined,
        });
        const approved = () =>
            sent
                .splice(0)
                .flatMap((r) => (r.kind === "approveAccessGatePayment" ? [r.amount] : []));

        await client.joinGroup(g, paying(150_000n));
        await client.joinGroup(g, paying(100_000n));
        expect(approved()).toEqual([140_000n, 90_000n]);

        // 150 isn't allowed any more: approved again
        await client.joinGroup(g, paying(150_000n));
        expect(approved()).toEqual([140_000n]);
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

    // 8b invariant 1: a guest's Join sends no join request, and after sign-in the recorded join is
    // sent exactly once, in every tree
    test("a guest's join is handed out once, after sign-in and once chats have loaded", async () => {
        currentUserStore.set(anonymousUser());
        const g = group(ROLE_NONE);
        await client.joinGroup(g);
        expect(sent).toEqual([]);

        expect(client.takePostLoginJoin()).toBeUndefined();
        identityStateStore.update((s) => ({ ...s, kind: "logged_in" }));
        chatsInitialisedStore.set(false);
        expect(client.takePostLoginJoin()).toBeUndefined();

        chatsInitialisedStore.set(true);
        expect(client.takePostLoginJoin()).toEqual({ kind: "join_group", group: g });
        expect(client.takePostLoginJoin()).toBeUndefined();
        expect(identityStateStore.value.postLogin).toBeUndefined();
        chatsInitialisedStore.set(false);
    });
});

describe("cancelling a preview", () => {
    let client: OpenChat;
    let sent: WorkerRequest[];
    let removedCommunity: MockInstance<OpenChat["removeCommunity"]>;
    let removedChat: MockInstance<OpenChat["removePreviewedChat"]>;

    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        currentUserStore.set({ ...anonymousUser(), userId: "me" });
        client = new OpenChat(config());
        sent = [];
        vi.spyOn(WorkerAgent.prototype, "send").mockImplementation(((req: WorkerRequest) => {
            sent.push(req);
            return Promise.resolve({ kind: "success" });
        }) as never);
        // the local removals would outlive the test
        removedCommunity = vi.spyOn(client, "removeCommunity").mockImplementation(() => {});
        removedChat = vi.spyOn(client, "removePreviewedChat").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        currentUserStore.set(anonymousUser());
        serverGroupChatsStore.set(new ChatMap<GroupChatSummary>());
        serverCommunitiesStore.set(new CommunityMap<CommunitySummary>());
        communityPreviewOriginStore.set(undefined);
    });

    // 8b invariant 7: cancelling a private group's preview declines the invitation
    test("cancelling a private group's preview declines the invitation", () => {
        const g = { ...group(ROLE_NONE), public: false };
        serverGroupChatsStore.set(new ChatMap<GroupChatSummary>().set(g.id, g));

        client.cancelPreview(g.id);

        expect(sent).toMatchObject([{ kind: "declineInvitation", chatId: g.id }]);
        expect(removedChat).toHaveBeenCalledWith(g.id);
    });

    test("cancelling a public group's preview declines nothing", () => {
        const g = group(ROLE_NONE);
        serverGroupChatsStore.set(new ChatMap<GroupChatSummary>().set(g.id, g));

        client.cancelPreview(g.id);

        expect(sent).toEqual([]);
    });

    // cancelling a community preview entered from Explore goes back there, once; otherwise to the
    // default scope
    test("cancelling a community preview goes back where it was opened from", () => {
        const c = community(ROLE_NONE);
        serverCommunitiesStore.set(CommunityMap.fromList([c]));
        const scope = client.cancelPreview({ kind: "community", communityId: "other" });

        client.setCommunityPreviewOrigin(communityId.communityId, "/communities?q=cats");
        expect(client.cancelPreview(communityId)).toBe("/communities?q=cats");
        expect(removedCommunity).toHaveBeenCalledWith(communityId);

        serverCommunitiesStore.set(CommunityMap.fromList([c]));
        expect(client.cancelPreview(communityId)).toBe(scope);
    });

    test("a previewed community's origin isn't another community's", () => {
        serverCommunitiesStore.set(CommunityMap.fromList([community(ROLE_NONE)]));
        const scope = client.cancelPreview({ kind: "community", communityId: "other" });

        client.setCommunityPreviewOrigin("other", "/communities");
        expect(client.cancelPreview(communityId)).toBe(scope);
    });

    // leaving the community another way (the selected community changing), or joining it, ends
    // its preview: a later preview of it doesn't go back to the old search
    test("a community left or joined no longer goes back where its preview was opened from", async () => {
        serverCommunitiesStore.set(CommunityMap.fromList([community(ROLE_NONE)]));

        client.setCommunityPreviewOrigin(communityId.communityId, "/communities?q=cats");
        client.removeCommunityIfPreviewing({ kind: "community", communityId: "other" });
        expect(communityPreviewOriginStore.value?.communityId).toBe(communityId.communityId);
        client.removeCommunityIfPreviewing(communityId);
        expect(communityPreviewOriginStore.value).toBeUndefined();

        vi.mocked(WorkerAgent.prototype.send).mockImplementation(((req: WorkerRequest) =>
            Promise.resolve(
                req.kind === "joinCommunity"
                    ? { kind: "success", community: { ...community(ROLE_MEMBER), channels: [] } }
                    : { kind: "success" },
            )) as never);
        vi.spyOn(localUpdates, "addCommunity").mockImplementation(() => {});
        client.setCommunityPreviewOrigin(communityId.communityId, "/communities?q=cats");
        expect(await client.joinCommunity(community(ROLE_NONE))).toEqual({ kind: "success" });
        expect(communityPreviewOriginStore.value).toBeUndefined();
    });

    // a channel of a community being previewed: the community's preview is the one cancelled
    test("cancelling a channel's preview in a previewed community cancels the community's", () => {
        serverCommunitiesStore.set(CommunityMap.fromList([community(ROLE_NONE)]));
        client.setCommunityPreviewOrigin(communityId.communityId, "/welcome");

        const path = client.cancelPreview({
            kind: "channel",
            communityId: communityId.communityId,
            channelId: 1,
        });

        expect(path).toBe("/welcome");
        expect(removedCommunity).toHaveBeenCalledWith(communityId);
    });
});

describe("a payment gate's split", () => {
    // 8b invariant 8: the owner and treasury shares of a payment gate sum to its amount, for any
    // amount
    test("the owner and treasury shares sum to the amount, for any amount", () => {
        for (const amount of [0n, 1n, 49n, 50n, 12_345_678n, 100_000_000n, 2n ** 70n + 3n]) {
            const { owner, treasury } = paymentGateSplit(amount);
            expect(owner + treasury).toBe(amount);
            expect(owner).toBe((amount * 98n) / 100n);
        }
        expect(paymentGateSplit(100_000_000n)).toEqual({
            owner: 98_000_000n,
            treasury: 2_000_000n,
        });
    });
});

describe("joining a chat with games in it", () => {
    let client: OpenChat;
    let joinedChat: ReturnType<typeof vi.spyOn>;
    const channelId = {
        kind: "channel" as const,
        communityId: communityId.communityId,
        channelId: 1,
    };

    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        currentUserStore.set({ ...anonymousUser(), userId: "me" });
        client = new OpenChat({ ...config(), miniAppServiceUrl: "https://minigames.example.com" });
        joinedChat = vi.spyOn(MiniAppService.prototype, "joinedChat");
        vi.spyOn(WorkerAgent.prototype, "send").mockImplementation(((req: WorkerRequest) => {
            switch (req.kind) {
                case "joinGroup":
                    return Promise.resolve({ kind: "success", group: group(ROLE_MEMBER) });
                case "joinCommunity":
                    return Promise.resolve({
                        kind: "success",
                        community: { ...community(ROLE_MEMBER), channels: [{ id: channelId }] },
                    });
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

    // so a user who was only watching its games may join them
    test("gets fresh tokens for the chat's games once the user's a member", async () => {
        expect(await client.joinGroup(group(ROLE_NONE))).toEqual({ kind: "success" });
        expect(joinedChat).toHaveBeenCalledWith(chatId);

        await client.joinCommunity(community(ROLE_NONE));
        expect(joinedChat).toHaveBeenCalledWith(channelId);
    });
});
