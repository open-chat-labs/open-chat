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
    Stream,
    type ChatEvent,
    type CommunityDetailsResponse,
    type CommunitySummary,
    type EventsResponse,
    type GroupChatDetailsResponse,
    type GroupChatSummary,
    type Member,
    type WorkerRequest,
} from "@shared";
import type { OpenChatConfig } from "./config";
import { OpenChat } from "./openchat";
import {
    currentUserIdStore,
    routeStore,
    selectedChatMembersStore,
    selectedChatUserIdsStore,
    selectedCommunityMembersStore,
    selectedServerChatStore,
    selectedServerCommunityStore,
    serverCommunitiesStore,
    serverEventsStore,
    serverGroupChatsStore,
} from "./state";
import { WorkerAgent } from "./workerAgent";

// The details of a chat or community can hold tens of thousands of members, and are asked for
// whenever its summary moves on, which it does with every message (for a community, every message
// in any of its channels). Details which are already held and haven't changed must not be sent
// across from the worker again, nor be rebuilt into the stores.

class FakeWorker {
    onmessage: ((ev: MessageEvent) => void) | undefined;
    postMessage() {}
    addEventListener() {}
}

const id = { kind: "community" as const, communityId: "aaaaa-aa" };

// The summary is always newer than the details loaded in these tests, which is what has the
// details asked for again. `detailsLastUpdated` is only set by canisters which support it.
function community(detailsLastUpdated?: bigint): CommunitySummary {
    return {
        kind: "community",
        id,
        name: "c",
        description: "",
        memberCount: 2,
        channels: [],
        lastUpdated: 1000n,
        detailsLastUpdated,
        membership: { role: ROLE_MEMBER, archived: false, pinned: [], index: 0, lapsed: false },
        gateConfig: { gate: { kind: "no_gate" }, expiry: undefined },
        permissions: {},
        userGroups: new Map(),
        moderationFlags: 0,
    } as unknown as CommunitySummary;
}

const chatId = { kind: "group_chat" as const, groupId: "bbbbb-bb" };

function groupChat(detailsLastUpdated?: bigint): GroupChatSummary {
    return {
        kind: "group_chat",
        id: chatId,
        name: "g",
        description: "",
        public: true,
        minVisibleEventIndex: 0,
        minVisibleMessageIndex: 0,
        latestEventIndex: 0,
        latestMessageIndex: undefined,
        latestMessage: undefined,
        membership: { role: ROLE_MEMBER, archived: false, lapsed: false },
        gateConfig: { gate: { kind: "no_gate" }, expiry: undefined },
        permissions: {},
        level: "group",
        eventsTTL: undefined,
        eventsTtlLastUpdated: 0n,
        lastUpdated: 1000n,
        detailsLastUpdated,
        memberCount: 2,
        subtype: undefined,
        frozen: false,
        dateLastPinned: undefined,
        messagesVisibleToNonMembers: false,
        localUserIndex: "",
        isInvited: false,
        historyVisible: true,
        blobReference: undefined,
        blobData: undefined,
    } as unknown as GroupChatSummary;
}

function chatDetails(timestamp: bigint, members: Member[]): GroupChatDetailsResponse {
    return {
        members,
        blockedUsers: new Set(),
        invitedUsers: new Set(),
        pinnedMessages: new Set(),
        rules: { text: "", enabled: false, version: 0 },
        timestamp,
        bots: [],
        webhooks: [],
    };
}

function member(userId: string): Member {
    return { userId, role: ROLE_MEMBER, displayName: undefined, lapsed: false };
}

function details(lastUpdated: bigint, members: Member[]): CommunityDetailsResponse {
    return {
        kind: "success",
        members,
        blockedUsers: new Set(),
        invitedUsers: new Set(),
        rules: { text: "", enabled: false, version: 0 },
        lastUpdated,
        userGroups: new Map(),
        referrals: new Set(),
        bots: [],
    };
}

function config(): OpenChatConfig {
    return {
        mobileLayout: "v1",
        websiteVersion: "test",
        logger: { error: vi.fn(), debug: vi.fn(), warn: vi.fn(), log: vi.fn() },
        proposalBotCanister: "aaaaa-aa",
    } as unknown as OpenChatConfig;
}

describe("loading the selected community's details", () => {
    let client: OpenChat;
    let requests: Extract<WorkerRequest, { kind: "getCommunityDetails" }>[];
    let responses: CommunityDetailsResponse[];

    async function load() {
        await client.setSelectedCommunity(id);
        // the details are loaded without being awaited
        await new Promise((r) => setTimeout(r, 0));
    }

    function setSummary(summary: CommunitySummary) {
        const communities = new CommunityMap<CommunitySummary>();
        communities.set(id, summary);
        serverCommunitiesStore.set(communities);
    }

    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        routeStore.set({
            kind: "selected_community_route",
            scope: { kind: "community", id },
            communityId: id,
        });
        setSummary(community());
        client = new OpenChat(config());

        requests = [];
        responses = [];
        vi.spyOn(WorkerAgent.prototype, "send").mockImplementation(((req: WorkerRequest) => {
            switch (req.kind) {
                case "getCommunityDetails":
                    requests.push(req);
                    return Promise.resolve(responses.shift());
                case "getUsers":
                    return Promise.resolve({ users: [], deletedUserIds: new Set() });
                default:
                    return new Promise(() => {});
            }
        }) as never);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        selectedServerCommunityStore.set(undefined);
        serverCommunitiesStore.set(new CommunityMap<CommunitySummary>());
    });

    test("details not yet held are asked for in full", async () => {
        responses.push(details(10n, [member("a"), member("b")]));

        await load();

        expect(requests).toHaveLength(1);
        expect(requests[0].detailsSyncedUpTo).toBeUndefined();
        expect([...selectedCommunityMembersStore.value.keys()]).toEqual(["a", "b"]);
        expect(selectedServerCommunityStore.value?.timestamp).toBe(10n);
    });

    test("details already held which haven't changed aren't rebuilt", async () => {
        responses.push(details(10n, [member("a"), member("b")]));
        await load();
        const members = selectedCommunityMembersStore.value;
        let published = 0;
        const unsub = selectedCommunityMembersStore.subscribe(() => published++);
        // subscribing publishes the current value
        expect(published).toBe(1);

        responses.push({ kind: "success_no_updates", lastUpdated: 20n });
        await load();

        expect(requests[1].detailsSyncedUpTo).toBe(10n);
        expect(published).toBe(1);
        expect(selectedCommunityMembersStore.value).toBe(members);
        // but they are now known to be good up to the later timestamp
        expect(selectedServerCommunityStore.value?.timestamp).toBe(20n);
        unsub();
    });

    test("details already held which have changed are replaced", async () => {
        responses.push(details(10n, [member("a"), member("b")]));
        await load();

        responses.push(details(20n, [member("a"), member("b"), member("c")]));
        await load();

        expect(requests[1].detailsSyncedUpTo).toBe(10n);
        expect([...selectedCommunityMembersStore.value.keys()]).toEqual(["a", "b", "c"]);
        expect(selectedServerCommunityStore.value?.timestamp).toBe(20n);
    });

    test("the worker isn't asked if the summary says the details held haven't changed", async () => {
        setSummary(community(10n));
        responses.push(details(10n, [member("a"), member("b")]));
        await load();
        expect(requests[0].detailsLastUpdated).toBe(10n);

        // The community has been updated since, by a message say, but not its details
        await load();

        expect(requests).toHaveLength(1);
    });

    test("the worker is asked for details which the summary says have changed", async () => {
        setSummary(community(10n));
        responses.push(details(10n, [member("a"), member("b")]));
        await load();

        setSummary(community(20n));
        responses.push(details(20n, [member("a"), member("b"), member("c")]));
        await load();

        expect(requests[1].detailsLastUpdated).toBe(20n);
        expect(requests[1].detailsSyncedUpTo).toBe(10n);
        expect([...selectedCommunityMembersStore.value.keys()]).toEqual(["a", "b", "c"]);
    });
});

describe("loading the selected chat's details", () => {
    let client: OpenChat;
    let requests: Extract<WorkerRequest, { kind: "getGroupDetails" }>[];
    let responses: GroupChatDetailsResponse[];

    async function load() {
        await client.setSelectedChat(chatId);
        // the details are loaded once the chat's events have been, neither of which is awaited
        await new Promise((r) => setTimeout(r, 10));
    }

    function setSummary(summary: GroupChatSummary) {
        const chats = new ChatMap<GroupChatSummary>();
        chats.set(chatId, summary);
        serverGroupChatsStore.set(chats);
    }

    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        vi.spyOn(console, "debug").mockImplementation(() => {});
        routeStore.set({
            kind: "global_chat_selected_route",
            scope: { kind: "chats" },
            chatId,
            chatType: "group_chat",
            open: false,
        });
        setSummary(groupChat());
        client = new OpenChat(config());

        requests = [];
        responses = [];
        vi.spyOn(WorkerAgent.prototype, "stream").mockImplementation(() => {
            const resp = {
                events: [],
                expiredEventRanges: [],
                latestEventIndex: 0,
            } as unknown as EventsResponse<ChatEvent>;
            return new Stream((resolve) => setTimeout(() => resolve(resp, true), 0)) as never;
        });
        vi.spyOn(WorkerAgent.prototype, "send").mockImplementation(((req: WorkerRequest) => {
            switch (req.kind) {
                case "getGroupDetails":
                    requests.push(req);
                    return Promise.resolve(responses.shift());
                case "getUsers":
                    return Promise.resolve({ users: [], deletedUserIds: new Set() });
                default:
                    return new Promise(() => {});
            }
        }) as never);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        selectedServerChatStore.set(undefined);
        serverGroupChatsStore.set(new ChatMap<GroupChatSummary>());
        serverEventsStore.set([]);
    });

    test("details not yet held are asked for in full", async () => {
        responses.push(chatDetails(10n, [member("a"), member("b")]));

        await load();

        expect(requests).toHaveLength(1);
        expect(requests[0].detailsSyncedUpTo).toBeUndefined();
        expect([...selectedChatMembersStore.value.keys()]).toEqual(["a", "b"]);
        expect(selectedServerChatStore.value?.timestamp).toBe(10n);
    });

    test("details already held which haven't changed aren't rebuilt", async () => {
        responses.push(chatDetails(10n, [member("a"), member("b")]));
        await load();
        const members = selectedChatMembersStore.value;
        let published = 0;
        const unsub = selectedChatMembersStore.subscribe(() => published++);
        // subscribing publishes the current value
        expect(published).toBe(1);

        responses.push({ kind: "success_no_updates", timestamp: 20n });
        await load();

        expect(requests[1].detailsSyncedUpTo).toBe(10n);
        expect(published).toBe(1);
        expect(selectedChatMembersStore.value).toBe(members);
        // but they are now known to be good up to the later timestamp
        expect(selectedServerChatStore.value?.timestamp).toBe(20n);
        unsub();
    });

    test("details already held which have changed are replaced", async () => {
        responses.push(chatDetails(10n, [member("a"), member("b")]));
        await load();

        responses.push(chatDetails(20n, [member("a"), member("b"), member("c")]));
        await load();

        expect(requests[1].detailsSyncedUpTo).toBe(10n);
        expect([...selectedChatMembersStore.value.keys()]).toEqual(["a", "b", "c"]);
        expect(selectedServerChatStore.value?.timestamp).toBe(20n);
    });

    test("the worker isn't asked if the summary says the details held haven't changed", async () => {
        setSummary(groupChat(10n));
        responses.push(chatDetails(10n, [member("a"), member("b")]));
        await load();
        expect(requests[0].detailsLastUpdated).toBe(10n);

        // The chat has been updated since, by a message say, but not its details
        await load();

        expect(requests).toHaveLength(1);
    });

    test("the worker is asked for details which the summary says have changed", async () => {
        setSummary(groupChat(10n));
        responses.push(chatDetails(10n, [member("a"), member("b")]));
        await load();

        setSummary(groupChat(20n));
        responses.push(chatDetails(20n, [member("a"), member("b"), member("c")]));
        await load();

        expect(requests[1].detailsLastUpdated).toBe(20n);
        expect(requests[1].detailsSyncedUpTo).toBe(10n);
        expect([...selectedChatMembersStore.value.keys()]).toEqual(["a", "b", "c"]);
    });

    test("a late reply that nothing has changed leaves another chat's details alone", async () => {
        const other = { kind: "group_chat" as const, groupId: "ccccc-cc" };
        responses.push(chatDetails(10n, [member("a")]));
        await load();

        // The reply to the next request only arrives once the store holds another chat's
        // details, as it can if the user switches to that chat and back in the meantime
        let reply: (resp: GroupChatDetailsResponse) => void = () => {};
        responses.push(new Promise((resolve) => (reply = resolve)) as never);
        await load();
        expect(requests[1].detailsSyncedUpTo).toBe(10n);
        selectedServerChatStore.update((state) => {
            if (state !== undefined) state.chatId = other;
            return state;
        });
        reply({ kind: "success_no_updates", timestamp: 20n });
        await new Promise((r) => setTimeout(r, 0));

        expect(selectedServerChatStore.value?.timestamp).toBe(10n);
    });

    test("details held for another chat are not taken to be this chat's", async () => {
        const other = { kind: "group_chat" as const, groupId: "ccccc-cc" };
        responses.push(chatDetails(10n, [member("a")]));
        await load();
        // The store keeps the last chat's details until the next chat's arrive
        selectedServerChatStore.update((state) => {
            if (state !== undefined) state.chatId = other;
            return state;
        });

        responses.push(chatDetails(5n, [member("b")]));
        await load();

        expect(requests[1].detailsSyncedUpTo).toBeUndefined();
        expect([...selectedChatMembersStore.value.keys()]).toEqual(["b"]);
    });
});

// A chat with more members than are loaded at once has only some of them held, so the users who
// appear in its events are looked up among its members
describe("looking up the members who appear in a chat when not all are held", () => {
    let client: OpenChat;
    let lookups: Extract<WorkerRequest, { kind: "lookupMembers" }>[];
    let lookupResponses: Member[][];
    let senders: string[];

    function messageFrom(sender: string, index: number) {
        return {
            index,
            timestamp: BigInt(1000 + index),
            expiresAt: undefined,
            event: {
                kind: "message",
                messageIndex: index,
                messageId: BigInt(100 + index),
                sender,
                content: { kind: "text_content", text: "hello" },
                reactions: [],
                tips: {},
                edited: false,
                forwarded: false,
                deleted: false,
                blockLevelMarkdown: false,
            },
        };
    }

    async function load() {
        await client.setSelectedChat(chatId);
        await new Promise((r) => setTimeout(r, 10));
    }

    function setup(details: GroupChatDetailsResponse) {
        const chats = new ChatMap<GroupChatSummary>();
        chats.set(chatId, {
            ...groupChat(),
            latestEventIndex: 3,
            latestMessageIndex: 3,
            latestMessage: messageFrom("a", 3),
        } as unknown as GroupChatSummary);
        serverGroupChatsStore.set(chats);
        client = new OpenChat(config());

        vi.spyOn(WorkerAgent.prototype, "stream").mockImplementation(() => {
            const resp = {
                events: senders.map((s, i) => messageFrom(s, i + 1)),
                expiredEventRanges: [],
                latestEventIndex: 3,
            } as unknown as EventsResponse<ChatEvent>;
            return new Stream((resolve) => setTimeout(() => resolve(resp, true), 0)) as never;
        });
        vi.spyOn(WorkerAgent.prototype, "send").mockImplementation(((req: WorkerRequest) => {
            switch (req.kind) {
                case "getGroupDetails":
                    return Promise.resolve(
                        req.detailsSyncedUpTo === undefined
                            ? details
                            : { kind: "success_no_updates", timestamp: req.detailsSyncedUpTo },
                    );
                case "lookupMembers":
                    lookups.push(req);
                    return Promise.resolve({
                        kind: "success",
                        members: lookupResponses.shift() ?? [],
                    });
                case "getUsers":
                    return Promise.resolve({ users: [], deletedUserIds: new Set() });
                default:
                    return new Promise(() => {});
            }
        }) as never);
    }

    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        vi.spyOn(console, "debug").mockImplementation(() => {});
        routeStore.set({
            kind: "global_chat_selected_route",
            scope: { kind: "chats" },
            chatId,
            chatType: "group_chat",
            open: false,
        });
        selectedChatUserIdsStore.set(new Set());
        lookups = [];
        lookupResponses = [];
        senders = ["a", "x", "y"];
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        selectedServerChatStore.set(undefined);
        serverGroupChatsStore.set(new ChatMap<GroupChatSummary>());
        serverEventsStore.set([]);
    });

    test("those who aren't held are looked up, and added if they are members", async () => {
        setup({ ...chatDetails(10n, [member("a"), member("b")]), moreMembersAfter: "b" });
        lookupResponses.push([member("x")]);

        await load();

        expect(lookups).toHaveLength(1);
        expect(lookups[0].id).toEqual(chatId);
        // The current user is looked up too, since what is shown of them is just as much in need
        // of being right
        expect(new Set(lookups[0].userIds)).toEqual(new Set(["x", "y", currentUserIdStore.value]));
        expect([...selectedChatMembersStore.value.keys()]).toEqual(["a", "b", "x"]);
        // There are still more members which aren't held
        expect(selectedServerChatStore.value?.moreMembersAfter).toBe("b");
    });

    test("nobody is looked up twice, whether or not they turned out to be a member", async () => {
        setup({ ...chatDetails(10n, [member("a"), member("b")]), moreMembersAfter: "b" });
        lookupResponses.push([member("x")]);
        await load();

        senders = ["x", "y", "z"];
        await load();

        expect(lookups).toHaveLength(2);
        expect(lookups[1].userIds).toEqual(["z"]);
    });

    test("a lapsed member who is looked up is held as lapsed", async () => {
        setup({ ...chatDetails(10n, [member("a"), member("b")]), moreMembersAfter: "b" });
        lookupResponses.push([{ ...member("x"), lapsed: true }]);

        await load();

        expect(selectedChatMembersStore.value.has("x")).toBe(false);
        expect(selectedServerChatStore.value?.lapsedMembers.has("x")).toBe(true);
    });

    test("nobody is looked up if every member is held", async () => {
        setup(chatDetails(10n, [member("a"), member("b")]));

        await load();

        expect(lookups).toHaveLength(0);
    });
});
