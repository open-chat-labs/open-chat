import { type EventWrapper, type GroupChatIdentifier, type Message } from "openchat-shared";
import { SvelteMap } from "svelte/reactivity";
import { vi } from "vitest";
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
