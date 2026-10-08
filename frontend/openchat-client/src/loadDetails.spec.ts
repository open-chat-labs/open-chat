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

import { Principal } from "@icp-sdk/core/principal";
import {
    ChatMap,
    CommunityMap,
    ROLE_MEMBER,
    Stream,
    anonymousUser,
    type ChannelIdentifier,
    type ChatEvent,
    type CommunityDetailsResponse,
    type CommunitySummary,
    type DirectChatSummary,
    type EventWrapper,
    type EventsResponse,
    type GroupChatDetailsResponse,
    type GroupChatSummary,
    type LookupMembersResponse,
    type Member,
    type UserSummary,
    type WorkerRequest,
} from "@shared";
import type { OpenChatConfig } from "./config";
import { OpenChat } from "./openchat";
import {
    currentUserStore,
    routeStore,
    selectedChatMembersStore,
    selectedChatUserIdsStore,
    selectedCommunityMembersStore,
    selectedServerChatStore,
    selectedServerCommunityStore,
    serverCommunitiesStore,
    serverDirectChatsStore,
    serverEventsStore,
    serverGroupChatsStore,
} from "./state";
import { userStore } from "./state/users/state";
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
    // Only valid user ids are sent
    const userId = (n: number) =>
        Principal.fromUint8Array(new Uint8Array([n >> 8, n & 255])).toText();
    const [me, a, b, x, y, z] = [1, 2, 3, 4, 5, 6].map(userId);
    const otherChatId = { kind: "group_chat" as const, groupId: "ccccc-cc" };

    let client: OpenChat;
    let lookups: Extract<WorkerRequest, { kind: "lookupMembers" }>[];
    // Each lookup is answered with the next of these, or else with no members
    let lookupResponses: (LookupMembersResponse | Promise<LookupMembersResponse>)[];
    let senders: string[];
    let events: () => EventWrapper<ChatEvent>[];
    // What the details held are replaced by when next asked for, if anything
    let replacement: GroupChatDetailsResponse | undefined;

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
        } as unknown as EventWrapper<ChatEvent>;
    }

    function found(...members: Member[]): LookupMembersResponse {
        return { kind: "success", members };
    }

    async function load(id: typeof chatId | ChannelIdentifier = chatId) {
        await client.setSelectedChat(id);
        await new Promise((r) => setTimeout(r, 10));
    }

    function select(id: typeof chatId) {
        routeStore.set({
            kind: "global_chat_selected_route",
            scope: { kind: "chats" },
            chatId: id,
            chatType: "group_chat",
            open: false,
        });
    }

    function summary(id: typeof chatId): GroupChatSummary {
        return {
            ...groupChat(),
            id,
            latestEventIndex: 3,
            latestMessageIndex: 3,
            latestMessage: messageFrom(a, 3),
        } as unknown as GroupChatSummary;
    }

    // `details` are the details of the chat when not already held; those of the other chat never
    // arrive
    function setup(details: GroupChatDetailsResponse) {
        const chats = new ChatMap<GroupChatSummary>();
        chats.set(chatId, summary(chatId));
        chats.set(otherChatId, summary(otherChatId));
        serverGroupChatsStore.set(chats);
        client = new OpenChat(config());

        vi.spyOn(WorkerAgent.prototype, "stream").mockImplementation(() => {
            const resp = {
                events: events(),
                expiredEventRanges: [],
                latestEventIndex: 3,
            } as unknown as EventsResponse<ChatEvent>;
            return new Stream((resolve) => setTimeout(() => resolve(resp, true), 0)) as never;
        });
        vi.spyOn(WorkerAgent.prototype, "send").mockImplementation(((req: WorkerRequest) => {
            switch (req.kind) {
                case "getGroupDetails":
                    if (req.chatId.kind === "group_chat" && req.chatId.groupId !== chatId.groupId) {
                        return new Promise(() => {});
                    }
                    return Promise.resolve(
                        req.detailsSyncedUpTo === undefined
                            ? details
                            : (replacement ?? {
                                  kind: "success_no_updates",
                                  timestamp: req.detailsSyncedUpTo,
                              }),
                    );
                case "lookupMembers":
                    lookups.push(req);
                    return Promise.resolve(lookupResponses.shift() ?? found());
                case "getUsers":
                    return Promise.resolve({ users: [], deletedUserIds: new Set() });
                default:
                    return new Promise(() => {});
            }
        }) as never);
    }

    const someHeld = () => ({
        ...chatDetails(10n, [member(a), member(b)]),
        moreMembersAfter: b,
    });

    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        vi.spyOn(console, "debug").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        select(chatId);
        currentUserStore.set({ ...anonymousUser(), userId: me });
        selectedChatUserIdsStore.set(new Set());
        lookups = [];
        lookupResponses = [];
        replacement = undefined;
        senders = [a, x, y];
        events = () => senders.map((s, i) => messageFrom(s, i + 1));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        currentUserStore.set(anonymousUser());
        selectedServerChatStore.set(undefined);
        serverGroupChatsStore.set(new ChatMap<GroupChatSummary>());
        serverEventsStore.set([]);
    });

    test("those who aren't held are looked up, and added if they are members", async () => {
        setup(someHeld());
        lookupResponses.push(found(member(x)));

        await load();

        expect(lookups).toHaveLength(1);
        expect(lookups[0].id).toEqual(chatId);
        // The current user comes first, since what is shown of them matters most to them
        expect(lookups[0].userIds[0]).toBe(me);
        expect(new Set(lookups[0].userIds)).toEqual(new Set([me, x, y]));
        // Only a replica which has caught up with the details held is asked
        expect(lookups[0].latestKnownUpdate).toBe(10n);
        expect([...selectedChatMembersStore.value.keys()]).toEqual([a, b, x]);
        // There are still more members which aren't held
        expect(selectedServerChatStore.value?.moreMembersAfter).toBe(b);
    });

    test("nobody is looked up again once held or known not to be a member", async () => {
        setup(someHeld());
        lookupResponses.push(found(member(x)));
        await load();

        senders = [x, y, z];
        await load();

        expect(lookups).toHaveLength(2);
        expect(lookups[1].userIds).toEqual([z]);
    });

    test("nobody is looked up if every member is held", async () => {
        setup(chatDetails(10n, [member(a), member(b)]));

        await load();

        expect(lookups).toHaveLength(0);
    });

    test("those whose lookup fails are looked up again when next seen", async () => {
        setup(someHeld());
        lookupResponses.push({ kind: "error", code: 0, message: undefined } as never);
        await load();

        lookupResponses.push(found(member(x)));
        await load();

        expect(lookups).toHaveLength(2);
        expect(new Set(lookups[1].userIds)).toEqual(new Set([me, x, y]));
        expect(selectedChatMembersStore.value.has(x)).toBe(true);
    });

    test("members found after the details have been updated are looked up again", async () => {
        setup(someHeld());
        let reply: (resp: LookupMembersResponse) => void = () => {};
        lookupResponses.push(new Promise((resolve) => (reply = resolve)));
        await load();

        // A member who was looked up may have left in an update which has been applied since
        selectedServerChatStore.update((state) => {
            if (state !== undefined) state.timestamp = 20n;
            return state;
        });
        reply(found(member(x)));
        await new Promise((r) => setTimeout(r, 0));
        expect(selectedChatMembersStore.value.has(x)).toBe(false);

        senders = [x];
        await load();

        expect(lookups).toHaveLength(2);
        expect(lookups[1].userIds).toEqual([x]);
        expect(lookups[1].latestKnownUpdate).toBe(20n);
    });

    test("those found not to be members are looked up again once the details are replaced", async () => {
        setup(someHeld());
        await load();
        expect(new Set(lookups[0].userIds)).toEqual(new Set([me, x, y]));

        // y has since joined, and the details have been loaded in full, as a first page which
        // doesn't hold them
        replacement = { ...chatDetails(20n, [member(a), member(b)]), moreMembersAfter: b };
        lookupResponses.push(found(member(y)));
        await load();

        expect(lookups).toHaveLength(2);
        expect(new Set(lookups[1].userIds)).toEqual(new Set([me, x, y]));
        expect(lookups[1].latestKnownUpdate).toBe(20n);
        expect(selectedChatMembersStore.value.has(y)).toBe(true);
    });

    test("the anonymous user and user ids which aren't valid aren't looked up", async () => {
        currentUserStore.set(anonymousUser());
        // as from a mention which someone typed
        senders = [x, "not_a_principal"];
        setup(someHeld());

        await load();
        await load();

        expect(lookups).toHaveLength(1);
        expect(lookups[0].userIds).toEqual([x]);
    });

    test("any number of users are looked up, a batch at a time", async () => {
        const many = Array.from({ length: 1500 }, (_, i) => userId(1000 + i));
        events = () => [
            {
                index: 1,
                timestamp: 1001n,
                expiresAt: undefined,
                event: { kind: "members_added", userIds: many, addedBy: a },
            } as unknown as EventWrapper<ChatEvent>,
        ];
        setup(someHeld());

        await load();

        expect(lookups.map((l) => l.userIds.length)).toEqual([1000, 501]);
        expect(lookups[0].userIds[0]).toBe(me);
        expect(new Set(lookups.flatMap((l) => l.userIds))).toEqual(new Set([me, ...many]));
    });

    test("the users of a newly selected chat aren't looked up in the last one's details", async () => {
        setup(someHeld());
        await load();
        expect(lookups).toHaveLength(1);

        // The store keeps the last chat's details until the next chat's arrive, which here they
        // never do
        select(otherChatId);
        senders = [z];
        await load(otherChatId);

        expect(lookups).toHaveLength(1);
        expect(selectedServerChatStore.value?.chatId).toEqual(chatId);
    });
});

describe("looking up the members of a community who appear in one of its channels", () => {
    const userId = (n: number) => Principal.fromUint8Array(new Uint8Array([n])).toText();
    const [me, a, x] = [1, 2, 3].map(userId);
    const channelId = { kind: "channel" as const, communityId: id.communityId, channelId: 1 };

    let client: OpenChat;
    let lookups: Extract<WorkerRequest, { kind: "lookupMembers" }>[];

    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        vi.spyOn(console, "debug").mockImplementation(() => {});
        currentUserStore.set({ ...anonymousUser(), userId: me });
        routeStore.set({
            kind: "selected_channel_route",
            scope: { kind: "community", id },
            communityId: id,
            chatId: channelId,
            open: false,
        });
        const channel = {
            ...groupChat(),
            kind: "channel",
            id: channelId,
            latestEventIndex: 1,
            latestMessageIndex: 1,
        } as unknown as GroupChatSummary;
        const communities = new CommunityMap<CommunitySummary>();
        communities.set(id, { ...community(), channels: [channel] } as unknown as CommunitySummary);
        serverCommunitiesStore.set(communities);
        client = new OpenChat(config());

        lookups = [];
        const message = {
            index: 1,
            timestamp: 1001n,
            expiresAt: undefined,
            event: {
                kind: "message",
                messageIndex: 1,
                messageId: 101n,
                sender: x,
                content: { kind: "text_content", text: "hello" },
                reactions: [],
                tips: {},
                edited: false,
                forwarded: false,
                deleted: false,
                blockLevelMarkdown: false,
            },
        };
        vi.spyOn(WorkerAgent.prototype, "stream").mockImplementation(() => {
            const resp = {
                events: [message],
                expiredEventRanges: [],
                latestEventIndex: 1,
            } as unknown as EventsResponse<ChatEvent>;
            return new Stream((resolve) => setTimeout(() => resolve(resp, true), 0)) as never;
        });
        vi.spyOn(WorkerAgent.prototype, "send").mockImplementation(((req: WorkerRequest) => {
            switch (req.kind) {
                case "getCommunityDetails":
                    // The community holds only some of its members
                    return Promise.resolve({ ...details(10n, [member(a)]), moreMembersAfter: a });
                case "getGroupDetails":
                    // The channel holds all of its members
                    return Promise.resolve(chatDetails(10n, [member(a), member(x)]));
                case "lookupMembers":
                    lookups.push(req);
                    return Promise.resolve({
                        kind: "success",
                        members: req.userIds
                            .filter((u) => u === x)
                            .map((u) => ({ ...member(u), displayName: "X" })),
                    });
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
        currentUserStore.set(anonymousUser());
        selectedServerChatStore.set(undefined);
        selectedServerCommunityStore.set(undefined);
        serverCommunitiesStore.set(new CommunityMap<CommunitySummary>());
        serverEventsStore.set([]);
    });

    test("the senders in a channel are looked up among the community's members", async () => {
        await client.setSelectedCommunity(id);
        await client.setSelectedChat(channelId);
        await new Promise((r) => setTimeout(r, 10));

        // Each is looked up once, whichever of the community's details and the channel's events
        // arrive first
        expect(lookups.every((l) => l.id.kind === "community" && l.latestKnownUpdate === 10n)).toBe(
            true,
        );
        expect(lookups.flatMap((l) => l.userIds).sort()).toEqual([me, x].sort());
        // So that their display name in the community is known
        expect(selectedCommunityMembersStore.value.get(x)?.displayName).toBe("X");
    });
});

// A chat with more members than are loaded at once has only some of them held, so searching among
// its members also looks up the users found who aren't held
function userSummary(userId: string) {
    return {
        kind: "user",
        userId,
        username: `user_${userId}`,
        displayName: undefined,
        updated: 0n,
        suspended: false,
        diamondStatus: "inactive",
        chitBalance: 0,
        totalChitEarned: 0,
        streak: 0,
        maxStreak: 0,
        isUniquePerson: false,
        hideOnlineStatus: false,
    } as UserSummary;
}

describe("finding members when not all are held", () => {
    const userId = (n: number) => Principal.fromUint8Array(new Uint8Array([n])).toText();
    const [a, b, x, z] = [2, 3, 5, 6].map(userId);

    let client: OpenChat;
    let lookups: Extract<WorkerRequest, { kind: "lookupMembers" }>[];
    // Each lookup is answered with the next of these, or else with no members
    let lookupResponses: (Member[] | Promise<Member[]>)[];
    let found: string[];
    // The pages of users the user search returns, if not just `found`
    let pages: string[][] | undefined;
    let searches: Extract<WorkerRequest, { kind: "searchUsers" }>[];

    async function select(details: GroupChatDetailsResponse) {
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
                    return Promise.resolve(lookupResponses.shift() ?? []).then((members) => ({
                        kind: "success",
                        members,
                    }));
                case "searchUsers":
                    searches.push(req);
                    return Promise.resolve(
                        (pages === undefined ? found : (pages[req.pageIndex ?? 0] ?? [])).map(
                            userSummary,
                        ),
                    );
                case "getUsers":
                    return Promise.resolve({ users: [], deletedUserIds: new Set() });
                default:
                    return new Promise(() => {});
            }
        }) as never);
        await client.setSelectedChat(chatId);
        await new Promise((r) => setTimeout(r, 10));
        // Only the lookups made by what is being tested
        lookups = [];
    }

    const someHeld = () => ({
        ...chatDetails(10n, [member(a), member(b)]),
        moreMembersAfter: b,
    });

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
        const chats = new ChatMap<GroupChatSummary>();
        chats.set(chatId, groupChat());
        serverGroupChatsStore.set(chats);
        client = new OpenChat(config());
        vi.spyOn(WorkerAgent.prototype, "stream").mockImplementation(() => {
            const resp = {
                events: [],
                expiredEventRanges: [],
                latestEventIndex: 0,
            } as unknown as EventsResponse<ChatEvent>;
            return new Stream((resolve) => setTimeout(() => resolve(resp, true), 0)) as never;
        });
        selectedChatUserIdsStore.set(new Set());
        lookups = [];
        lookupResponses = [];
        found = [a, x, z];
        pages = undefined;
        searches = [];
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        selectedServerChatStore.set(undefined);
        serverGroupChatsStore.set(new ChatMap<GroupChatSummary>());
        serverEventsStore.set([]);
    });

    test("those found are looked up, and those who are members are returned and held", async () => {
        await select(someHeld());
        lookupResponses.push([member(x)]);

        const members = await client.findMembers(chatId, "user", 20);

        expect(members.map((u) => u.userId)).toEqual([a, x]);
        // Only those who aren't held are looked up
        expect(lookups.map((l) => l.userIds)).toEqual([[x, z]]);
        expect([...selectedChatMembersStore.value.keys()]).toEqual([a, b, x]);
    });

    test("nobody is looked up when every member is held", async () => {
        await select(chatDetails(10n, [member(a), member(b)]));

        const members = await client.findMembers(chatId, "user", 20);

        expect(members.map((u) => u.userId)).toEqual([a]);
        expect(lookups).toHaveLength(0);
    });

    test("users already being looked up are found by a search in the meantime", async () => {
        await select(someHeld());
        let reply: (members: Member[]) => void = () => {};
        lookupResponses.push(new Promise((resolve) => (reply = resolve)));

        const first = client.findMembers(chatId, "user", 20);
        const second = client.findMembers(chatId, "user", 20);
        await new Promise((r) => setTimeout(r, 0));
        reply([member(x)]);

        expect((await first).map((u) => u.userId)).toEqual([a, x]);
        expect((await second).map((u) => u.userId)).toEqual([a, x]);
        expect(lookups).toHaveLength(1);
    });

    // As many users as a page of the user search holds, none of them members (their ids are of two
    // bytes, so they're distinct from those above)
    const fullPage = (from: number) =>
        Array.from({ length: 255 }, (_, i) =>
            Principal.fromUint8Array(new Uint8Array([(from + i) >> 8, (from + i) & 255])).toText(),
        );

    test("further pages of users are searched until enough members are found", async () => {
        await select(someHeld());
        pages = [fullPage(1000), [x, z]];
        lookupResponses.push([], [member(x)]);

        const members = await client.findMembers(chatId, "user", 20);

        expect(members.map((u) => u.userId)).toEqual([x]);
        expect(searches.map((s) => s.pageIndex)).toEqual([0, 1]);
    });

    test("no more pages are searched once enough members are found", async () => {
        await select(someHeld());
        pages = [[...fullPage(1000).slice(1), x], fullPage(2000)];
        lookupResponses.push([member(x)]);

        const members = await client.findMembers(chatId, "user", 1);

        expect(members.map((u) => u.userId)).toEqual([x]);
        expect(searches.map((s) => s.pageIndex)).toEqual([0]);
    });

    test("a UserIndex which returns the first page again is taken to have no more", async () => {
        await select(someHeld());
        // as one which doesn't know about pages does
        const first = fullPage(1000);
        pages = [first, first, first, first];

        await client.findMembers(chatId, "user", 20);

        expect(searches).toHaveLength(2);
        // and the users of the repeated page aren't looked up again
        expect(lookups).toHaveLength(1);
    });

    test("members found are offered as mentions", async () => {
        await select(someHeld());
        expect(client.getUserLookupForMentions()[`user_${x}`]).toBeUndefined();
        lookupResponses.push([member(x)]);

        await client.findMembersToMention("user");

        expect(client.getUserLookupForMentions()[`user_${x}`]).toMatchObject({ userId: x });
    });

    test("members who aren't held are left out of those to invite", async () => {
        await select(someHeld());
        lookupResponses.push([member(x)]);

        const [, toInvite] = await client.searchUsersForInvite("user", 20, "group", false, true);

        expect(toInvite.map((u) => u.userId)).toEqual([z]);
    });
});

describe("finding users to add to a channel when not all members are held", () => {
    const userId = (n: number) => Principal.fromUint8Array(new Uint8Array([n])).toText();
    // `a` is a member of the community and the channel, both of which hold them; `b` is a member of
    // the community, which holds them, but not the channel; `x` is a member of the community, which
    // doesn't hold them, but not the channel; `y` is a member of both, of which only the community
    // holds them (having looked them up, say); `z` isn't a member of either. `d` and `e` are members
    // of the community, which doesn't hold them, found only by their display names in it, of whom
    // `e` is a member of the channel too, which doesn't hold them. `w` is a member of the community,
    // which doesn't hold them, and of one of its user groups.
    const [me, a, b, x, y, z, d, e, f, w] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(userId);
    const channelId = { kind: "channel" as const, communityId: id.communityId, channelId: 1 };

    let client: OpenChat;
    let lookups: Extract<WorkerRequest, { kind: "lookupMembers" }>[];
    // The members of the channel which it doesn't hold
    let channelMembersNotHeld: string[];
    // The members of the community which it doesn't hold, and whose membership has lapsed
    let lapsedInCommunity: string[];
    // What searching the community's display names returns
    let displayNameResponse: LookupMembersResponse;
    let usersAskedFor: string[];

    beforeEach(async () => {
        vi.stubGlobal("Worker", FakeWorker);
        vi.spyOn(console, "debug").mockImplementation(() => {});
        currentUserStore.set({ ...anonymousUser(), userId: me });
        routeStore.set({
            kind: "selected_channel_route",
            scope: { kind: "community", id },
            communityId: id,
            chatId: channelId,
            open: false,
        });
        const channel = {
            ...groupChat(),
            kind: "channel",
            id: channelId,
        } as unknown as GroupChatSummary;
        const communities = new CommunityMap<CommunitySummary>();
        communities.set(id, { ...community(), channels: [channel] } as unknown as CommunitySummary);
        serverCommunitiesStore.set(communities);
        client = new OpenChat(config());

        lookups = [];
        channelMembersNotHeld = [y, e];
        lapsedInCommunity = [];
        displayNameResponse = {
            kind: "success",
            members: [
                { ...member(d), displayName: "Userina" },
                { ...member(e), displayName: "Usher" },
            ],
        };
        usersAskedFor = [];
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
                case "getCommunityDetails":
                    return Promise.resolve({
                        ...details(10n, [member(a), member(b), member(y)]),
                        moreMembersAfter: b,
                        userGroups: new Map([
                            [1, { kind: "user_group", id: 1, name: "g", members: new Set([w]) }],
                        ]),
                    });
                case "getGroupDetails":
                    return Promise.resolve({
                        ...chatDetails(10n, [member(a)]),
                        moreMembersAfter: a,
                    });
                case "lookupMembers": {
                    lookups.push(req);
                    const members =
                        req.id.kind === "community"
                            ? [
                                  { ...member(x), displayName: "X" },
                                  { ...member(w), displayName: "W" },
                                  ...lapsedInCommunity.map((u) => ({ ...member(u), lapsed: true })),
                              ]
                            : channelMembersNotHeld.map(member);
                    return Promise.resolve({
                        kind: "success",
                        members: members.filter((m) => req.userIds.includes(m.userId)),
                    });
                }
                case "searchUsers":
                    return Promise.resolve([a, b, x, y, z].map(userSummary));
                case "searchCommunityMembers":
                    return Promise.resolve(displayNameResponse);
                case "getUsers":
                    usersAskedFor.push(...req.users.userGroups.flatMap((g) => g.users));
                    return Promise.resolve({ users: [], deletedUserIds: new Set() });
                default:
                    return new Promise(() => {});
            }
        }) as never);

        await client.setSelectedCommunity(id);
        await client.setSelectedChat(channelId);
        await new Promise((r) => setTimeout(r, 10));
        userStore.addMany([a, b, y, d, e, f].map(userSummary));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        currentUserStore.set(anonymousUser());
        selectedServerChatStore.set(undefined);
        selectedServerCommunityStore.set(undefined);
        serverCommunitiesStore.set(new CommunityMap<CommunitySummary>());
        serverDirectChatsStore.set(new ChatMap<DirectChatSummary>());
        serverEventsStore.set([]);
    });

    test("members of the channel are left out, whether or not either holds them", async () => {
        const [communityMembers, others] = await client.searchUsersForInvite(
            "user",
            20,
            "channel",
            false,
            true,
        );

        // `d` is found only by their display name in the community, which the user search doesn't
        // know, and `e` likewise but is left out as a member of the channel
        expect(communityMembers.map((u) => u.userId)).toEqual([b, x, d]);
        // with their display names in the community
        expect(communityMembers[1].displayName).toBe("X");
        expect(communityMembers[2].displayName).toBe("Userina");
        expect(others.map((u) => u.userId)).toEqual([z]);
    });

    test("only members of the community are offered to add to the channel", async () => {
        const [communityMembers, others] = await client.searchCommunityMembersToAdd("user", 20);

        expect(communityMembers.map((u) => u.userId)).toEqual([b, x, d]);
        expect(others).toEqual([]);
    });

    test("a user who can't invite users is only offered members of the community", async () => {
        const [communityMembers, others] = await client.searchUsersForInvite(
            "user",
            20,
            "channel",
            false,
            false,
        );

        expect(communityMembers.map((u) => u.userId)).toEqual([b, x, d]);
        expect(others).toEqual([]);
    });

    test("members of the channel are found by their display names in the community", async () => {
        const found = await client.findMembers(channelId, "user", 20);

        // `d` isn't a member of the channel
        expect(found.map((u) => u.userId)).toEqual([a, y, e]);
        expect(found[2].displayName).toBe("Usher");
        // and is held from now on, as a member of the community
        expect(selectedCommunityMembersStore.value.get(d)?.displayName).toBe("Userina");
    });

    test("someone whose community membership has lapsed isn't invited to a channel they're in", async () => {
        lapsedInCommunity = [z];
        channelMembersNotHeld = [y, e, z];

        const [, others] = await client.searchUsersForInvite("user", 20, "channel", false, true);

        expect(others).toEqual([]);
    });

    test("those found by the user search are offered if display names can't be searched", async () => {
        displayNameResponse = { kind: "failure" } as never;

        const [communityMembers] = await client.searchCommunityMembersToAdd("user", 20);

        expect(communityMembers.map((u) => u.userId)).toEqual([b, x]);
    });

    test("a lapsed member found by their display name isn't offered, but is held as lapsed", async () => {
        displayNameResponse = {
            kind: "success",
            members: [{ ...member(f), displayName: "Userf", lapsed: true }],
        };

        const found = await client.findMembers(id, "user", 20);

        expect(found.map((u) => u.userId)).not.toContain(f);
        expect(selectedServerCommunityStore.value?.lapsedMembers.has(f)).toBe(true);
    });

    test("a channel which holds every member is searched by display name if its community isn't", async () => {
        selectedServerChatStore.update((state) => {
            if (state !== undefined) {
                state.moreMembersAfter = undefined;
                state.members = new Map([a, y, e].map((u) => [u, member(u)]));
            }
            return state;
        });
        expect(client.membersIncomplete(channelId)).toBe(false);
        expect(client.shouldSearchForMembers(channelId)).toBe(true);

        const found = await client.findMembers(channelId, "user", 20);

        // `e` is only found by their display name in the community
        expect(found.map((u) => u.userId)).toContain(e);
        expect(found.map((u) => u.userId)).not.toContain(d);
    });

    test("the members of the community's user groups are looked up, and their users loaded", async () => {
        await client.loadUserGroupMembers(id);

        expect(lookups.some((l) => l.id.kind === "community" && l.userIds.includes(w))).toBe(true);
        expect(selectedCommunityMembersStore.value.get(w)?.displayName).toBe("W");
        expect(usersAskedFor).toContain(w);
    });

    test("those you have direct chats with are looked up before being offered to add", async () => {
        const chats = new ChatMap<DirectChatSummary>();
        for (const userId of [x, y, z]) {
            chats.set({ kind: "direct_chat", userId }, {
                kind: "direct_chat",
                id: { kind: "direct_chat", userId },
                them: { userId },
            } as unknown as DirectChatSummary);
        }
        serverDirectChatsStore.set(chats);

        await client.lookupDirectChatUsersAmongChannelMembers();

        // So that `x` is offered, being a member of the community, and `y` isn't, being a member
        // of the channel already
        expect(selectedCommunityMembersStore.value.has(x)).toBe(true);
        expect(selectedChatMembersStore.value.has(y)).toBe(true);
    });
});
