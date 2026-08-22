import {
    type ChatSummary,
    type EventWrapper,
    type GroupChatIdentifier,
    type Message,
} from "@shared";
import { SvelteMap } from "svelte/reactivity";
import { vi } from "vitest";
import { withPausedStores } from "../../utils/stores";
import { localUpdates } from "../localUpdates";
import { MessageReadTracker, MessagesRead } from "./markRead";

const abcId: GroupChatIdentifier = { kind: "group_chat", groupId: "abc" };

describe("mark messages read", () => {
    const markRead = new MessageReadTracker();

    function createDummyMessage(messageId: bigint): EventWrapper<Message> {
        return {
            event: {
                kind: "message",
                messageId,
                messageIndex: 0,
                sender: "",
                content: {
                    kind: "text_content",
                    text: "",
                },
                reactions: [],
                tips: {},
                edited: false,
                forwarded: false,
                deleted: false,
                blockLevelMarkdown: false,
                ogPreviews: [],
                messagePreviews: [],
            },
            index: 0,
            timestamp: BigInt(0),
        };
    }

    beforeEach(() => {
        vi.useFakeTimers();
        localUpdates.clearUnconfirmed();
        if (markRead.value.waiting.get({ chatId: abcId }) !== undefined) {
            markRead.value.waiting.get({ chatId: abcId })?.clear();
        }
        markRead.value.state.set(abcId, new MessagesRead());
        markRead.value.serverState.set(abcId, new MessagesRead());
    });

    test("mark unconfirmed message as read", () => {
        localUpdates.addUnconfirmed({ chatId: abcId }, createDummyMessage(BigInt(100)));
        markRead.markMessageRead({ chatId: abcId }, 200, BigInt(100));
        expect(markRead.value.waiting.get({ chatId: abcId })?.has(BigInt(100))).toBe(true);
    });

    test("mark confirmed message as read", () => {
        const mr = new MessagesRead();
        mr.readUpTo = 199;
        markRead.value.state.set(abcId, mr);
        markRead.markMessageRead({ chatId: abcId }, 200, BigInt(500));
        expect(markRead.value.waiting.get({ chatId: abcId })?.has(BigInt(500))).toBe(false);
        expect(markRead.value.state.get(abcId)?.readUpTo).toBe(200);
    });

    test("confirm message", () => {
        markRead.value.waiting.get({ chatId: abcId })?.set(BigInt(100), 100);
        markRead.markMessageRead({ chatId: abcId }, 200, BigInt(100));
        markRead.confirmMessage({ chatId: abcId }, 200, BigInt(100));
        expect(markRead.value.waiting.get({ chatId: abcId })?.has(BigInt(100))).toBe(false);
        expect(markRead.value.state.get(abcId)?.readUpTo).toBe(200);
    });

    describe("thread stuff", () => {
        const threadSyncs = [
            {
                threadRootMessageIndex: 1,
                lastUpdated: BigInt(0),
                latestEventIndex: 0,
                latestMessageIndex: 3,
            },
            {
                threadRootMessageIndex: 2,
                lastUpdated: BigInt(0),
                latestEventIndex: 0,
                latestMessageIndex: 5,
            },
        ];
        beforeEach(() => {
            markRead.value.state.set(abcId, new MessagesRead());
            markRead.value.serverState.set(abcId, new MessagesRead());
        });

        describe("unread message count", () => {
            test("no messages read", () => {
                const unread = markRead.unreadThreadMessageCount(abcId, 1, 1);
                expect(unread).toEqual(2);
            });
            test("synced up with unread", () => {
                markRead.syncWithServer(
                    abcId,
                    undefined,
                    [{ threadRootMessageIndex: 1, readUpTo: 3 }],
                    undefined,
                );
                const unread = markRead.unreadThreadMessageCount(abcId, 1, 5);
                expect(unread).toEqual(2);
            });
            test("synced up with no unread", () => {
                markRead.syncWithServer(
                    abcId,
                    undefined,
                    [{ threadRootMessageIndex: 1, readUpTo: 3 }],
                    undefined,
                );
                const unread = markRead.unreadThreadMessageCount(abcId, 1, 3);
                expect(unread).toEqual(0);
            });
            test("up to date only locally", () => {
                markRead.syncWithServer(
                    abcId,
                    undefined,
                    [{ threadRootMessageIndex: 1, readUpTo: 3 }],
                    undefined,
                );
                markRead.markReadUpTo({ chatId: abcId, threadRootMessageIndex: 1 }, 5);
                const unread = markRead.unreadThreadMessageCount(abcId, 1, 5);
                expect(unread).toEqual(0);
            });
            test("local ahead of server, still not up to date", () => {
                markRead.syncWithServer(
                    abcId,
                    undefined,
                    [{ threadRootMessageIndex: 1, readUpTo: 3 }],
                    undefined,
                );
                markRead.markReadUpTo({ chatId: abcId, threadRootMessageIndex: 1 }, 5);
                const unread = markRead.unreadThreadMessageCount(abcId, 1, 7);
                expect(unread).toEqual(2);
            });
        });

        describe("stale thread count for chat", () => {
            test("up to date - no local", () => {
                markRead.syncWithServer(
                    abcId,
                    undefined,
                    [
                        { threadRootMessageIndex: 1, readUpTo: 3 },
                        { threadRootMessageIndex: 2, readUpTo: 5 },
                    ],
                    undefined,
                );
                const count = markRead.staleThreadCountForChat(abcId, threadSyncs);
                expect(count).toEqual(0);
            });
            test("with unread", () => {
                markRead.syncWithServer(
                    abcId,
                    undefined,
                    [
                        { threadRootMessageIndex: 1, readUpTo: 1 },
                        { threadRootMessageIndex: 2, readUpTo: 5 },
                    ],
                    undefined,
                );
                const count = markRead.staleThreadCountForChat(abcId, threadSyncs);
                expect(count).toEqual(1);
            });
            test("with unread + local updates", () => {
                markRead.syncWithServer(
                    abcId,
                    undefined,
                    [
                        { threadRootMessageIndex: 1, readUpTo: 1 },
                        { threadRootMessageIndex: 2, readUpTo: 5 },
                    ],
                    undefined,
                );
                markRead.markReadUpTo({ chatId: abcId, threadRootMessageIndex: 1 }, 2);
                const count = markRead.staleThreadCountForChat(abcId, threadSyncs);
                expect(count).toEqual(1);
            });
            test("with local updates - up to date", () => {
                markRead.syncWithServer(
                    abcId,
                    undefined,
                    [
                        { threadRootMessageIndex: 1, readUpTo: 1 },
                        { threadRootMessageIndex: 2, readUpTo: 5 },
                    ],
                    undefined,
                );
                markRead.markReadUpTo({ chatId: abcId, threadRootMessageIndex: 1 }, 3);
                const count = markRead.staleThreadCountForChat(abcId, threadSyncs);
                expect(count).toEqual(0);
            });
        });
    });

    describe("unread message count", () => {
        describe("when all messages are confirmed", () => {
            test("with no latest message + waiting local messages", () => {
                markRead.value.waiting.set({ chatId: abcId }, new SvelteMap<bigint, number>());
                markRead.value.waiting.get({ chatId: abcId })?.set(BigInt(0), 0);
                markRead.value.waiting.get({ chatId: abcId })?.set(BigInt(1), 1);
                markRead.value.waiting.get({ chatId: abcId })?.set(BigInt(2), 2);
                expect(markRead.unreadMessageCount(abcId, undefined)).toEqual(0);
            });
            test("with no latest message", () => {
                expect(markRead.unreadMessageCount(abcId, undefined)).toEqual(0);
            });
            test("with no messages read", () => {
                expect(markRead.unreadMessageCount(abcId, 100)).toEqual(101);
            });
            test("with server state only", () => {
                const mr = new MessagesRead();
                mr.readUpTo = 20;
                markRead.value.serverState.set(abcId, mr);
                expect(markRead.unreadMessageCount(abcId, 50)).toEqual(30);
            });
            test("with local state only", () => {
                const mr = new MessagesRead();
                mr.readUpTo = 30;
                markRead.value.state.set(abcId, mr);
                expect(markRead.unreadMessageCount(abcId, 50)).toEqual(20);
            });
            test("with server state ahead of local state", () => {
                const mr = new MessagesRead();
                mr.readUpTo = 90;
                const ms = new MessagesRead();
                ms.readUpTo = 50;
                markRead.value.serverState.set(abcId, mr);
                markRead.value.state.set(abcId, ms);
                expect(markRead.unreadMessageCount(abcId, 100)).toEqual(10);
            });
            test("with local state ahead of server state", () => {
                const mr = new MessagesRead();
                mr.readUpTo = 90;
                const ms = new MessagesRead();
                ms.readUpTo = 50;
                markRead.value.serverState.set(abcId, mr);
                markRead.value.state.set(abcId, ms);
                expect(markRead.unreadMessageCount(abcId, 100)).toEqual(10);
            });
        });
        describe("when some messages are unconfirmed", () => {
            test("with multiple gaps", () => {
                markRead.value.waiting.get({ chatId: abcId })?.set(BigInt(1), 11);
                markRead.value.waiting.get({ chatId: abcId })?.set(BigInt(2), 12);
                markRead.value.waiting.get({ chatId: abcId })?.set(BigInt(3), 13);
                const mr = new MessagesRead();
                mr.readUpTo = 10;
                markRead.value.serverState.set(abcId, mr);
                expect(markRead.unreadMessageCount(abcId, 100)).toEqual(87);
            });
        });
    });

    describe("combined unread count for chats", () => {
        function chat(
            groupId: string,
            latestMessageIndex: number,
            notificationsMuted: boolean,
        ): ChatSummary {
            return {
                kind: "group_chat",
                id: { kind: "group_chat", groupId },
                latestMessage: { event: { messageIndex: latestMessageIndex } },
                membership: { notificationsMuted, mentions: [], latestThreads: [] },
            } as unknown as ChatSummary;
        }

        test("counts unread chats, split by muted, skipping unknown and undefined chats", () => {
            const mr = new MessagesRead();
            mr.readUpTo = 20;
            markRead.value.serverState.set(abcId, mr);
            markRead.value.serverState.set({ kind: "group_chat", groupId: "def" }, mr);
            markRead.value.serverState.set({ kind: "group_chat", groupId: "ghi" }, mr);
            const chats = [
                chat("abc", 50, false),
                chat("def", 50, true),
                chat("ghi", 20, false), // fully read
                chat("unknown", 50, false), // no server state => previewed, not counted
                undefined,
            ];
            const counts = markRead.combinedUnreadCountForChats(chats);
            expect(counts.chats).toEqual({ muted: 1, unmuted: 1, mentions: false });
            expect(counts.threads).toEqual({ muted: 0, unmuted: 0, mentions: false });
        });
    });

    describe("incremental unread counts", () => {
        function chat(
            groupId: string,
            latestMessageIndex: number,
            notificationsMuted: boolean,
        ): ChatSummary {
            return {
                kind: "group_chat",
                id: { kind: "group_chat", groupId },
                latestMessage: { event: { messageIndex: latestMessageIndex } },
                membership: { notificationsMuted, mentions: [], latestThreads: [] },
            } as unknown as ChatSummary;
        }

        function setup(n: number) {
            const tracker = new MessageReadTracker();
            const chats: ChatSummary[] = [];
            for (let i = 0; i < n; i++) {
                const c = chat(`g${i}`, 50, i % 3 === 0);
                chats.push(c);
                tracker.syncWithServer(c.id, i % 5 === 0 ? 50 : 10, [], undefined);
            }
            return { tracker, chats };
        }

        test("marking one message read gives the same counts as a full recompute", () => {
            const { tracker, chats } = setup(300);
            const before = tracker.combinedUnreadCountForChats(chats);
            expect(before.chats).toEqual({ muted: 80, unmuted: 160, mentions: false });

            const spy = vi.spyOn(tracker, "unreadMessageCount");
            for (let i = 11; i <= 60; i++) {
                tracker.markMessageRead({ chatId: chats[1].id }, i, undefined);
                tracker.combinedUnreadCountForChats(chats);
            }
            tracker.markMessageRead({ chatId: chats[2].id }, 50, undefined);
            const after = tracker.combinedUnreadCountForChats(chats);
            const evaluations = spy.mock.calls.length;
            spy.mockRestore();

            // independent full computation with a fresh tracker
            const fresh = setup(300);
            fresh.tracker.markReadUpTo({ chatId: fresh.chats[1].id }, 60);
            fresh.tracker.markReadUpTo({ chatId: fresh.chats[2].id }, 50);
            expect(after).toEqual(fresh.tracker.combinedUnreadCountForChats(fresh.chats));
            expect(after.chats).toEqual({ muted: 80, unmuted: 158, mentions: false });
            // one evaluation per changed chat per recompute (was 51 x 300 before the per-chat cache)
            expect(evaluations).toEqual(51);
            console.log(
                `markRead.spec: per-chat evaluations for 51 marks over 300 chats: ${evaluations}`,
            );
        });

        test("a new chat object or a server sync is re-evaluated", () => {
            const { tracker, chats } = setup(10);
            expect(tracker.combinedUnreadCountForChats(chats).chats.unmuted).toEqual(5);
            // muting a chat by replacing its object
            const replaced = chats.slice();
            replaced[1] = chat("g1", 50, true);
            expect(tracker.combinedUnreadCountForChats(replaced).chats).toEqual({
                muted: 4,
                unmuted: 4,
                mentions: false,
            });
            // server sync marks g2 as fully read
            tracker.syncWithServer(chats[2].id, 50, [], undefined);
            expect(tracker.combinedUnreadCountForChats(chats).chats).toEqual({
                muted: 3,
                unmuted: 4,
                mentions: false,
            });
            // unconfirmed message read then removed
            tracker.removeUnconfirmedMessage({ chatId: chats[4].id }, BigInt(1));
            expect(tracker.combinedUnreadCountForChats(chats).chats.unmuted).toEqual(4);
        });
    });

    describe("batched marks", () => {
        test("marks inside withPausedStores publish once", () => {
            const tracker = new MessageReadTracker();
            let publishes = 0;
            const unsub = tracker.subscribe(() => publishes++);
            publishes = 0;
            withPausedStores(() => {
                for (let i = 1; i <= 10; i++) {
                    tracker.markMessageRead({ chatId: abcId }, i, undefined);
                }
            });
            expect(publishes).toEqual(1);
            expect(tracker.value.state.get(abcId)?.readUpTo).toEqual(10);
            unsub();
        });
    });

    describe("getting first unread message index", () => {
        test("where we have read everything", () => {
            markRead.markReadUpTo({ chatId: abcId }, 100);
            expect(markRead.getFirstUnreadMessageIndex(abcId, 100)).toEqual(undefined);
        });
        test("where we have no messages", () => {
            expect(markRead.getFirstUnreadMessageIndex(abcId, undefined)).toEqual(undefined);
        });
        test("where we have read nothing", () => {
            expect(markRead.getFirstUnreadMessageIndex(abcId, 100)).toEqual(0);
        });
        test("where we have read some messages", () => {
            markRead.markReadUpTo({ chatId: abcId }, 80);
            expect(markRead.getFirstUnreadMessageIndex(abcId, 100)).toEqual(81);
        });
    });
});
