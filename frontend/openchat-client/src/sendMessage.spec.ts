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
    CommunityMap,
    ROLE_MEMBER,
    anonymousUser,
    publish,
    type AttachmentContent,
    type ChannelIdentifier,
    type ChannelSummary,
    type CommunityIdentifier,
    type CommunitySummary,
    type EventWrapper,
    type Member,
    type Message,
    type MessageContext,
    type RehydratedMessagePreview,
    type RulesAcceptanceResolver,
    type SendMessageOutcome,
    type User,
    type UserSummary,
    type WorkerRequest,
} from "@shared";
import type { OpenChatConfig } from "./config";
import { OpenChat } from "./openchat";
import {
    currentUserStore,
    eventsStore,
    localUpdates,
    pinNumberRequiredStore,
    pinNumberResolverStore,
    routeStore,
    serverCommunitiesStore,
} from "./state";
import { ChatDetailsState } from "./state/chat/serverDetails";
import { currentChatVisit, serverEventsStore, startChatVisit } from "./state/selectedChat";
import { userStore } from "./state/users/state";
import { allUsersStore } from "./state/users/stores";
import { captureRulesAcceptanceStore } from "./stores/rules";
import { mostRecentStore } from "./stores/throttling";
import { WorkerAgent } from "./workerAgent";

// Sending from the composer settles once the message shows in the chat, or when it's refused
// before that, and the composer keeps the draft unless it was posted.

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

const here: CommunityIdentifier = { kind: "community", communityId: "aaaaa-aa" };
const chatId: ChannelIdentifier = { kind: "channel", communityId: here.communityId, channelId: 1 };
const context = { chatId };

function community(chatRulesAccepted: boolean): CommunitySummary {
    return {
        kind: "community",
        id: here,
        channels: [
            {
                kind: "channel",
                id: chatId,
                name: "c",
                description: "",
                public: true,
                minVisibleEventIndex: 0,
                minVisibleMessageIndex: 0,
                latestEventIndex: 0,
                latestMessageIndex: undefined,
                latestMessage: undefined,
                membership: {
                    role: ROLE_MEMBER,
                    archived: false,
                    lapsed: false,
                    rulesAccepted: chatRulesAccepted,
                    latestThreads: [],
                    mentions: [],
                },
                gateConfig: { gate: { kind: "no_gate" }, expiry: undefined },
                permissions: {},
                level: "channel",
                lastUpdated: 0n,
                memberCount: 2,
                frozen: false,
                historyVisible: true,
            } as unknown as ChannelSummary,
        ],
        membership: {
            role: ROLE_MEMBER,
            archived: false,
            pinned: [],
            index: 0,
            rulesAccepted: true,
        },
        userGroups: new Map(),
        lastUpdated: 0n,
    } as unknown as CommunitySummary;
}

const transfer = {
    kind: "crypto_content",
    transfer: { kind: "pending", ledger: "ryjl3-tyaaa-aaaaa-aaaba-cai", amountE8s: 1n },
} as unknown as AttachmentContent;

type Deferred<T> = {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason: unknown) => void;
};

function deferred<T>(): Deferred<T> {
    let resolve: (value: T) => void = () => {};
    let reject: (reason: unknown) => void = () => {};
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

describe("sending from the composer", () => {
    let client: OpenChat;
    // what reached the worker
    let sent: WorkerRequest[];

    beforeEach(() => {
        vi.useFakeTimers();
        vi.stubGlobal("Worker", FakeWorker);
        vi.spyOn(console, "debug").mockImplementation(() => {});
        currentUserStore.set({ ...anonymousUser(), userId: "me" });
        sent = [];
        // the worker never answers: a send that settles did so on posting, not on its result
        vi.spyOn(WorkerAgent.prototype, "stream").mockImplementation(((req: WorkerRequest) => {
            if (req.kind === "sendMessage") sent.push(req);
            return { subscribe: () => {} };
        }) as never);
        vi.spyOn(WorkerAgent.prototype, "send").mockImplementation(
            (() => new Promise(() => {})) as never,
        );
        const communities = new CommunityMap<CommunitySummary>();
        communities.set(here, community(true));
        serverCommunitiesStore.set(communities);
        routeStore.set({
            kind: "selected_channel_route",
            scope: { kind: "community", id: here },
            communityId: here,
            chatId,
            open: false,
        });
        client = new OpenChat(config());
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        currentUserStore.set(anonymousUser());
        captureRulesAcceptanceStore.set(undefined);
        pinNumberRequiredStore.set(undefined);
        pinNumberResolverStore.set(undefined);
        mostRecentStore.set([]);
        serverCommunitiesStore.set(new CommunityMap());
        localUpdates.draftMessages.delete(context);
        currentChatVisit()?.setDetails(undefined);
        startChatVisit(undefined);
    });

    // the chat has rules the user hasn't accepted
    function withRules() {
        const communities = new CommunityMap<CommunitySummary>();
        communities.set(here, community(false));
        serverCommunitiesStore.set(communities);
        startChatVisit(chatId);
        currentChatVisit()?.setDetails(
            new ChatDetailsState(
                chatId,
                0n,
                new Map(),
                new Set(),
                new Set(),
                new Set(),
                new Set(),
                new Map(),
                new Map(),
                { text: "be nice", enabled: true, version: 1 },
            ),
        );
    }

    // the prompt to accept the rules, if one is showing
    function rulesPrompt(): RulesAcceptanceResolver | undefined {
        let resolver: RulesAcceptanceResolver | undefined;
        captureRulesAcceptanceStore.subscribe((r) => (resolver = r))();
        return resolver;
    }

    function send(attachment?: AttachmentContent): Promise<SendMessageOutcome> {
        return client.sendMessage(context, "hello", false, attachment, []);
    }

    // a promise's outcome so far, without waiting for it
    async function settled<T>(p: Promise<T>): Promise<T | "pending"> {
        await vi.advanceTimersByTimeAsync(0);
        return Promise.race([p, Promise.resolve("pending" as const)]);
    }

    /** Invariant 3: posted means this send's message is in the chat, before the worker answers. */
    test("is posted once the message shows, before the result", async () => {
        expect(await settled(send())).toEqual({ kind: "posted" });
        expect(sent).toHaveLength(1);
    });

    /** Invariant 3: another message showing in the same chat (someone else's, a bot's) isn't this
     * send being posted. */
    test("isn't posted by another message showing in the chat", async () => {
        withRules();
        const result = send();
        publish("sendingMessage", context);
        // still waiting on the rules
        expect(await settled(result)).toBe("pending");
        rulesPrompt()?.resolve(false);
        expect(await settled(result)).toEqual({ kind: "rules_declined" });
    });

    /** Invariant 2: refused before posting, nothing reaches the worker. */
    test("the rules turned down send nothing", async () => {
        withRules();
        const result = send();
        await vi.advanceTimersByTimeAsync(0);
        rulesPrompt()?.resolve(false);
        expect(await settled(result)).toEqual({ kind: "rules_declined" });
        expect(sent).toHaveLength(0);
    });

    /** Invariants 2 and 5: a dismissed PIN prompt is an outcome, not a rejection, and sends nothing. */
    test("a dismissed PIN prompt sends nothing", async () => {
        pinNumberRequiredStore.set(true);
        const result = send(transfer);
        await vi.advanceTimersByTimeAsync(0);
        pinNumberResolverStore.value?.reject();
        expect(await settled(result)).toEqual({ kind: "pin_cancelled" });
        expect(sent).toHaveLength(0);
    });

    /** Invariants 1 and 2: throttled, nothing reaches the worker, and the chat isn't left busy. */
    test("throttled sends nothing", async () => {
        mostRecentStore.set(Array.from({ length: 100 }, () => Date.now()));
        expect(await settled(send())).toEqual({ kind: "throttled" });
        expect(sent).toHaveLength(0);
        mostRecentStore.set([]);
        expect(await settled(send())).toEqual({ kind: "posted" });
    });

    /** Invariant 1: a second send from the chat while one is on its way sends nothing. */
    test("a second send while one is on its way is busy", async () => {
        pinNumberRequiredStore.set(true);
        const first = send(transfer);
        expect(await settled(send())).toEqual({ kind: "busy" });
        pinNumberResolverStore.value?.resolve("1234");
        expect(await settled(first)).toEqual({ kind: "posted" });
        expect(sent).toHaveLength(1);
        // and once it's posted, the chat can send again
        expect(await settled(send())).toEqual({ kind: "posted" });
    });

    describe("a link to another message", () => {
        const url = `https://oc.app/community/${here.communityId}/channel/1/5`;
        const linked: RehydratedMessagePreview = {
            url,
            chatId,
            threadRootMessageIndex: undefined,
            message: {
                kind: "message",
                messageId: 5n,
                messageIndex: 5,
                sender: "them",
                content: { kind: "text_content", text: "linked" },
                reactions: [],
                tips: {},
                edited: false,
                forwarded: false,
                deleted: false,
                blockLevelMarkdown: false,
                ogPreviews: [],
            },
        };
        // what was asked of the worker besides sending
        let requests: WorkerRequest[];
        // the worker's lookup of the linked message, settled by each test
        let lookup: Deferred<RehydratedMessagePreview[]>;
        // where the worker's answer to the send goes
        let subscriber: { onResult(result: unknown): void } | undefined;
        // the worker's answer to an edit
        let editResult: Deferred<unknown>;

        beforeEach(() => {
            requests = [];
            lookup = deferred();
            subscriber = undefined;
            editResult = deferred();
            startChatVisit(chatId);
            vi.spyOn(WorkerAgent.prototype, "send").mockImplementation((async (
                req: WorkerRequest,
            ) => {
                requests.push(req);
                if (req.kind === "editMessage") return editResult.promise;
                if (req.kind !== "rehydrateMessage") return new Promise(() => {});
                const messagePreviews = await lookup.promise;
                return { ...req.message, event: { ...req.message.event, messagePreviews } };
            }) as never);
            vi.spyOn(WorkerAgent.prototype, "stream").mockImplementation(((req: WorkerRequest) => {
                if (req.kind === "sendMessage") sent.push(req);
                return { subscribe: (s: typeof subscriber) => (subscriber = s) };
            }) as never);
        });

        async function sendLink() {
            const outcome = client.sendMessage(context, `see ${url}`, false, undefined, []);
            expect(await settled(outcome)).toEqual({ kind: "posted" });
        }

        // the message the worker was given to send
        function sentMessage(): Message | undefined {
            return sent[0]?.kind === "sendMessage" ? sent[0].event.event : undefined;
        }

        function unconfirmed(): Message | undefined {
            const messageId = sentMessage()?.messageId;
            return localUpdates
                .unconfirmedMessages(context)
                .find((m) => m.event.messageId === messageId)?.event;
        }

        function confirmed(): Message | undefined {
            const messageId = sentMessage()?.messageId;
            const event = serverEventsStore.value.find(
                (e) => e.event.kind === "message" && e.event.messageId === messageId,
            )?.event;
            return event?.kind === "message" ? event : undefined;
        }

        // the worker says the message was sent
        async function confirm() {
            subscriber?.onResult([
                { kind: "success", timestamp: 1n, messageIndex: 0, eventIndex: 1 },
                sentMessage(),
            ]);
            await vi.advanceTimersByTimeAsync(0);
        }

        async function loadLinked(result: "found" | "failed") {
            if (result === "found") lookup.resolve([linked]);
            else lookup.reject(new Error("no access"));
            await vi.advanceTimersByTimeAsync(0);
        }

        test("is sent without waiting for the linked message, whose preview then shows", async () => {
            await sendLink();
            expect(sentMessage()?.messagePreviews).toEqual([]);
            expect(unconfirmed()?.messagePreviews).toEqual([]);
            await loadLinked("found");
            expect(unconfirmed()?.messagePreviews).toEqual([linked]);
        });

        test("keeps the preview once confirmed, when it was loaded first", async () => {
            await sendLink();
            await loadLinked("found");
            await confirm();
            expect(confirmed()?.messagePreviews).toEqual([linked]);
        });

        test("gets the preview once confirmed, when it's loaded after", async () => {
            await sendLink();
            await confirm();
            expect(confirmed()?.messagePreviews).toEqual([]);
            await loadLinked("found");
            expect(confirmed()?.messagePreviews).toEqual([linked]);
        });

        test("shows none when the linked message can't be loaded", async () => {
            vi.spyOn(console, "warn").mockImplementation(() => {});
            await sendLink();
            await loadLinked("failed");
            await confirm();
            expect(unconfirmed()).toBeUndefined();
            expect(confirmed()?.messagePreviews).toEqual([]);
        });

        test("isn't looked for in a message without one", async () => {
            await settled(send());
            expect(requests.filter((r) => r.kind === "rehydrateMessage")).toHaveLength(0);
            expect(sent).toHaveLength(1);
        });

        describe("edited", () => {
            const url2 = `https://oc.app/community/${here.communityId}/channel/1/6`;
            // each test edits a message of its own, since local updates outlive a test
            let nextMessageId = 1000n;
            let messageId: bigint;

            // a message in the chat, with `text` and the previews it was loaded with
            function inChat(text: string, messagePreviews: RehydratedMessagePreview[]) {
                messageId = nextMessageId++;
                const event: EventWrapper<Message> = {
                    index: 1,
                    timestamp: 1n,
                    event: {
                        ...linked.message,
                        messageId,
                        messageIndex: 0,
                        sender: "me",
                        content: { kind: "text_content", text },
                        messagePreviews,
                    },
                };
                currentChatVisit()?.updateEvents(() => [event]);
            }

            // the message as the chat shows it, which is what gets edited
            function shown(): EventWrapper<Message> | undefined {
                return eventsStore.value.find(
                    (e): e is EventWrapper<Message> =>
                        e.event.kind === "message" && e.event.messageId === messageId,
                );
            }

            async function edit(text: string, messageContext: MessageContext = context) {
                const editing = shown();
                if (editing === undefined) throw new Error("the message isn't in the chat");
                void client.editMessage(messageContext, text, false, editing);
                await vi.advanceTimersByTimeAsync(0);
            }

            const lookups = () => requests.filter((r) => r.kind === "rehydrateMessage");

            test("to link to a message, shows its preview once it's loaded", async () => {
                inChat("hello", []);
                await edit(`see ${url}`);
                expect(shown()?.event.messagePreviews).toEqual([]);
                await loadLinked("found");
                expect(shown()?.event.messagePreviews).toEqual([linked]);
            });

            test("to drop the link, drops its preview straight away", async () => {
                inChat(`see ${url}`, [linked]);
                await edit("never mind");
                expect(shown()?.event.messagePreviews).toEqual([]);
                expect(lookups()).toHaveLength(0);
            });

            test("keeping the link, keeps its preview without looking it up", async () => {
                inChat(`see ${url}`, [linked]);
                await edit(`see ${url} again`);
                expect(shown()?.event.messagePreviews).toEqual([linked]);
                expect(lookups()).toHaveLength(0);
            });

            test("to add a link, keeps the others' previews if it can't be looked up", async () => {
                vi.spyOn(console, "warn").mockImplementation(() => {});
                inChat(`see ${url}`, [linked]);
                await edit(`see ${url} and ${url2}`);
                await loadLinked("failed");
                expect(shown()?.event.messagePreviews).toEqual([linked]);
            });

            test("again, to drop the link before it's loaded, doesn't show it", async () => {
                inChat("hello", []);
                await edit(`see ${url}`);
                await edit("hello again");
                await loadLinked("found");
                expect(shown()?.event.messagePreviews).toEqual([]);
            });

            test("again, keeping the link before it's loaded, shows it once it is", async () => {
                inChat("hello", []);
                await edit(`see ${url}`);
                await edit(`see ${url} now`);
                await loadLinked("found");
                expect(shown()?.event.messagePreviews).toEqual([linked]);
            });

            test("unsuccessfully, doesn't show the preview it went on to load", async () => {
                inChat("hello", []);
                await edit(`see ${url}`);
                // the edit is refused before the linked message has loaded
                editResult.resolve({ kind: "failure" });
                await vi.advanceTimersByTimeAsync(0);
                await loadLinked("found");
                expect(shown()?.event.content).toEqual({ kind: "text_content", text: "hello" });
                expect(shown()?.event.messagePreviews).toEqual([]);
            });

            test("unsuccessfully, drops the preview it had already loaded", async () => {
                inChat("hello", []);
                await edit(`see ${url}`);
                await loadLinked("found");
                editResult.resolve({ kind: "failure" });
                await vi.advanceTimersByTimeAsync(0);
                expect(shown()?.event.content).toEqual({ kind: "text_content", text: "hello" });
                expect(shown()?.event.messagePreviews).toEqual([]);
            });

            test("in a thread, looks the linked message up in the thread", async () => {
                inChat("hello", []);
                await edit(`see ${url}`, { chatId, threadRootMessageIndex: 3 });
                expect(lookups()[0]).toMatchObject({ threadRootMessageIndex: 3 });
            });

            test("to drop the link before a send's lookup lands, isn't undone by it", async () => {
                await sendLink();
                await confirm();
                messageId = sentMessage()?.messageId ?? 0n;
                await edit("never mind");
                await loadLinked("found");
                expect(shown()?.event.messagePreviews).toEqual([]);
            });
        });
    });

    describe("mentions typed as @username", () => {
        const userId = (n: number) => Principal.fromUint8Array(new Uint8Array([n])).toText();
        // alice is a member the chat holds, xavier one it doesn't, and zed a user who isn't a member
        const [alice, xavier, zed] = [2, 3, 4].map(userId);
        const userIds: Record<string, string> = { alice, xavier, zed, myself: "me" };
        // the usernames looked up
        let lookedUp: string[];
        // whether looking users up by username fails
        let failing: boolean;
        // the edits sent to the worker
        let edits: Extract<WorkerRequest, { kind: "editMessage" }>[];

        const member = (userId: string): Member => ({
            userId,
            role: ROLE_MEMBER,
            displayName: undefined,
            lapsed: false,
        });

        const user = (userId: string, username: string): UserSummary => ({
            kind: "user",
            userId,
            username,
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
        });

        // the chat, holding alice, and either all of its members or only some
        function holding(allMembers: boolean) {
            startChatVisit(chatId);
            currentChatVisit()?.setDetails(
                new ChatDetailsState(
                    chatId,
                    10n,
                    new Map([[alice, member(alice)]]),
                    new Set(),
                    new Set(),
                    new Set(),
                    new Set(),
                    new Map(),
                    new Map(),
                    undefined,
                    allMembers ? undefined : alice,
                ),
            );
        }

        beforeEach(() => {
            lookedUp = [];
            failing = false;
            edits = [];
            currentUserStore.set({ ...anonymousUser(), userId: "me", username: "myself" });
            // xavier's summary isn't held either, so is loaded once he's found
            allUsersStore.update((users) => {
                users.delete(xavier);
                return users;
            });
            userStore.addMany([user(alice, "alice"), user(zed, "zed")]);
            vi.spyOn(WorkerAgent.prototype, "send").mockImplementation((async (
                req: WorkerRequest,
            ) => {
                switch (req.kind) {
                    case "getUserIdByUsername":
                        lookedUp.push(req.username);
                        if (failing) throw new Error("offline");
                        return userIds[req.username];
                    case "lookupMembers":
                        return {
                            kind: "success",
                            members: req.userIds.filter((u) => u === xavier).map(member),
                        };
                    case "getUsers":
                        return {
                            users: req.users.userGroups
                                .flatMap((g) => g.users)
                                .filter((u) => u === xavier)
                                .map((u) => user(u, "xavier")),
                            deletedUserIds: new Set(),
                        };
                    case "editMessage":
                        edits.push(req);
                        return new Promise(() => {});
                    default:
                        return new Promise(() => {});
                }
            }) as never);
        });

        // the text sent, and the users it mentions
        async function sendText(
            text: string,
            picked: User[] = [],
        ): Promise<{ text: string; mentioned: string[] }> {
            const outcome = client.sendMessage(context, text, false, undefined, picked);
            expect(await settled(outcome)).toEqual({ kind: "posted" });
            const req = sent[0];
            if (req?.kind !== "sendMessage" || req.event.event.content.kind !== "text_content") {
                throw new Error("nothing was sent");
            }
            return {
                text: req.event.event.content.text,
                mentioned: req.mentioned.map((u) => u.userId),
            };
        }

        test("a member the chat doesn't hold is looked up and mentioned", async () => {
            holding(false);
            expect(await sendText("hi @Xavier")).toEqual({
                text: `hi @UserId(${xavier})`,
                mentioned: [xavier],
            });
            expect(lookedUp).toEqual(["xavier"]);
        });

        test("a user who isn't a member of the chat isn't mentioned", async () => {
            holding(false);
            expect(await sendText("hi @zed")).toEqual({ text: "hi @zed", mentioned: [] });
        });

        test("those the chat holds, and the sender, aren't looked up", async () => {
            holding(false);
            expect(await sendText("@alice and @myself")).toEqual({
                text: `@UserId(${alice}) and @myself`,
                mentioned: [alice],
            });
            expect(lookedUp).toEqual([]);
        });

        test("nobody is looked up in a chat which holds all its members", async () => {
            holding(true);
            expect(await sendText("hi @xavier")).toEqual({ text: "hi @xavier", mentioned: [] });
            expect(lookedUp).toEqual([]);
        });

        test("if the lookup fails, the mention is sent as typed", async () => {
            holding(false);
            failing = true;
            expect(await sendText("hi @xavier")).toEqual({ text: "hi @xavier", mentioned: [] });
        });

        test("those picked from the mention picker are mentioned too, once", async () => {
            holding(false);
            expect(await sendText(`@UserId(${alice}) and @alice`, [user(alice, "alice")])).toEqual({
                text: `@UserId(${alice}) and @UserId(${alice})`,
                mentioned: [alice],
            });
            // and a picked mention isn't taken for a username
            expect(lookedUp).toEqual([]);
        });

        test("an edit mentions a member the chat doesn't hold", async () => {
            holding(false);
            const editing = {
                index: 1,
                timestamp: 1n,
                event: {
                    kind: "message",
                    messageId: 2000n,
                    messageIndex: 0,
                    sender: "me",
                    content: { kind: "text_content", text: "hi" },
                    reactions: [],
                    tips: {},
                    edited: false,
                    forwarded: false,
                    deleted: false,
                    blockLevelMarkdown: false,
                    ogPreviews: [],
                    messagePreviews: [],
                },
            } as unknown as EventWrapper<Message>;
            void client.editMessage(context, "hi @xavier", false, editing);
            await vi.advanceTimersByTimeAsync(0);
            expect(edits[0]?.msg.content).toEqual({
                kind: "text_content",
                text: `hi @UserId(${xavier})`,
            });
        });
    });
});
