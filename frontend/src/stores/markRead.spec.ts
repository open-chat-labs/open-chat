import DRange from "drange";
import { MessageReadTracker, MessagesRead } from "./markRead";
import { unconfirmed } from "./unconfirmed";
import { rangesAreEqual } from "../domain/chat/chat.utils";
import type { EventWrapper, Message } from "../domain/chat/chat";

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
                edited: false,
                forwarded: false,
            },
            index: 0,
            timestamp: BigInt(0),
        };
    }

    beforeEach(() => {
        jest.useFakeTimers();
        unconfirmed.clear();
        if (markRead.waiting["abc"] !== undefined) {
            markRead.waiting["abc"].clear();
        }
        markRead.state["abc"] = new MessagesRead();
        markRead.serverState["abc"] = new MessagesRead();
        markRead.publish();
    });

    test("mark unconfirmed message as read", () => {
        unconfirmed.add("abc", createDummyMessage(BigInt(100)));
        markRead.markMessageRead("abc", 200, BigInt(100));
        expect(markRead.waiting["abc"].has(BigInt(100))).toBe(true);
    });

    test("mark confirmed message as read", () => {
        markRead.state["abc"] = new MessagesRead();
        markRead.state["abc"].ranges = new DRange(199, 199);
        markRead.markMessageRead("abc", 200, BigInt(500));
        expect(markRead.waiting["abc"].has(BigInt(500))).toBe(false);
        expect(rangesAreEqual(markRead.state["abc"].ranges, new DRange(199, 200)));
    });

    test("confirm message", () => {
        markRead.waiting["abc"].set(BigInt(100), 100);
        markRead.markMessageRead("abc", 200, BigInt(100));
        markRead.confirmMessage("abc", 200, BigInt(100));
        expect(markRead.waiting["abc"].has(BigInt(100))).toBe(false);
        expect(rangesAreEqual(markRead.state["abc"].ranges, new DRange(200, 200)));
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
            markRead.state["abc"] = new MessagesRead();
            markRead.serverState["abc"] = new MessagesRead();
        });

        describe("unread message count", () => {
            test("no messages read", () => {
                const unread = markRead.unreadThreadMessageCount("abc", 1, 1);
                expect(unread).toEqual(2);
            });
            test("synced up with unread", () => {
                markRead.syncWithServer("abc", new DRange(), [
                    { threadRootMessageIndex: 1, readUpTo: 3 },
                ]);
                const unread = markRead.unreadThreadMessageCount("abc", 1, 5);
                expect(unread).toEqual(2);
            });
            test("synced up with no unread", () => {
                markRead.syncWithServer("abc", new DRange(), [
                    { threadRootMessageIndex: 1, readUpTo: 3 },
                ]);
                const unread = markRead.unreadThreadMessageCount("abc", 1, 3);
                expect(unread).toEqual(0);
            });
            test("up to date only locally", () => {
                markRead.syncWithServer("abc", new DRange(), [
                    { threadRootMessageIndex: 1, readUpTo: 3 },
                ]);
                markRead.markThreadRead("abc", 1, 5);
                const unread = markRead.unreadThreadMessageCount("abc", 1, 5);
                expect(unread).toEqual(0);
            });
            test("local ahead of server, still not up to date", () => {
                markRead.syncWithServer("abc", new DRange(), [
                    { threadRootMessageIndex: 1, readUpTo: 3 },
                ]);
                markRead.markThreadRead("abc", 1, 5);
                const unread = markRead.unreadThreadMessageCount("abc", 1, 7);
                expect(unread).toEqual(2);
            });
        });

        describe("stale thread count for chat", () => {
            test("up to date - no local", () => {
                markRead.syncWithServer("abc", new DRange(), [
                    { threadRootMessageIndex: 1, readUpTo: 3 },
                    { threadRootMessageIndex: 2, readUpTo: 5 },
                ]);
                const count = markRead.staleThreadCountForChat("abc", threadSyncs);
                expect(count).toEqual(0);
            });
            test("with unread", () => {
                markRead.syncWithServer("abc", new DRange(), [
                    { threadRootMessageIndex: 1, readUpTo: 1 },
                    { threadRootMessageIndex: 2, readUpTo: 5 },
                ]);
                const count = markRead.staleThreadCountForChat("abc", threadSyncs);
                expect(count).toEqual(1);
            });
            test("with unread + local updates", () => {
                markRead.syncWithServer("abc", new DRange(), [
                    { threadRootMessageIndex: 1, readUpTo: 1 },
                    { threadRootMessageIndex: 2, readUpTo: 5 },
                ]);
                markRead.markThreadRead("abc", 1, 2);
                const count = markRead.staleThreadCountForChat("abc", threadSyncs);
                expect(count).toEqual(1);
            });
            test("with local updates - up to date", () => {
                markRead.syncWithServer("abc", new DRange(), [
                    { threadRootMessageIndex: 1, readUpTo: 1 },
                    { threadRootMessageIndex: 2, readUpTo: 5 },
                ]);
                markRead.markThreadRead("abc", 1, 3);
                const count = markRead.staleThreadCountForChat("abc", threadSyncs);
                expect(count).toEqual(0);
            });
        });
    });

    describe("unread message count", () => {
        describe("when all messages are confirmed", () => {
            test("with no latest message + waiting local messages", () => {
                markRead.waiting["abc"] = new Map<bigint, number>();
                markRead.waiting["abc"].set(BigInt(0), 0);
                markRead.waiting["abc"].set(BigInt(1), 1);
                markRead.waiting["abc"].set(BigInt(2), 2);
                expect(markRead.unreadMessageCount("abc", 0, undefined)).toEqual(0);
            });
            test("with no latest message", () => {
                expect(markRead.unreadMessageCount("abc", 0, undefined)).toEqual(0);
            });
            test("with no messages read", () => {
                expect(markRead.unreadMessageCount("abc", 0, 100)).toEqual(101);
            });
            test("with no gaps", () => {
                markRead.serverState["abc"] = new MessagesRead();
                markRead.serverState["abc"].ranges = new DRange(0, 50);
                markRead.state["abc"] = new MessagesRead();
                markRead.state["abc"].ranges = new DRange(51, 100);
                expect(markRead.unreadMessageCount("abc", 0, 100)).toEqual(0);
            });
            test("with gap at the beginning", () => {
                markRead.serverState["abc"] = new MessagesRead();
                markRead.serverState["abc"].ranges = new DRange(10, 50);
                markRead.state["abc"] = new MessagesRead();
                markRead.state["abc"].ranges = new DRange(51, 100);
                expect(markRead.unreadMessageCount("abc", 0, 100)).toEqual(10);
            });
            test("with gaps at both ends", () => {
                markRead.serverState["abc"] = new MessagesRead();
                markRead.serverState["abc"].ranges = new DRange(10, 50);
                markRead.state["abc"] = new MessagesRead();
                markRead.state["abc"].ranges = new DRange(51, 90);
                expect(markRead.unreadMessageCount("abc", 0, 100)).toEqual(20);
            });
            test("with multiple gaps", () => {
                markRead.serverState["abc"] = new MessagesRead();
                markRead.serverState["abc"].ranges = new DRange(10, 30);
                markRead.state["abc"] = new MessagesRead();
                markRead.state["abc"].ranges = new DRange(40, 50).add(60, 70);
                expect(markRead.unreadMessageCount("abc", 0, 100)).toEqual(58);
            });
        });
        describe("when some messages are unconfirmed", () => {
            test("with multiple gaps", () => {
                markRead.waiting["abc"].set(BigInt(0), 0);
                markRead.waiting["abc"].set(BigInt(1), 1);
                markRead.waiting["abc"].set(BigInt(2), 2);
                markRead.waiting["abc"].set(BigInt(3), 3);
                markRead.serverState["abc"] = new MessagesRead();
                markRead.serverState["abc"].ranges = new DRange(10, 30);
                markRead.state["abc"] = new MessagesRead();
                markRead.state["abc"].ranges = new DRange(40, 50).add(60, 70);
                expect(markRead.unreadMessageCount("abc", 0, 100)).toEqual(54);
            });
        });
    });

    describe("getting first unread message index", () => {
        test("where we have read everything", () => {
            markRead.markRangeRead("abc", 0, 100);
            expect(markRead.getFirstUnreadMessageIndex("abc", 0, 100)).toEqual(undefined);
        });
        test("where we have no messages", () => {
            expect(markRead.getFirstUnreadMessageIndex("abc", 0, undefined)).toEqual(undefined);
        });
        test("where we have read nothing", () => {
            expect(markRead.getFirstUnreadMessageIndex("abc", 0, 100)).toEqual(0);
        });
        test("where we are missing messages at the end", () => {
            markRead.markRangeRead("abc", 0, 80);
            expect(markRead.getFirstUnreadMessageIndex("abc", 0, 100)).toEqual(81);
        });
        test("where we are missing messages at the beginning", () => {
            markRead.markRangeRead("abc", 20, 80);
            expect(markRead.getFirstUnreadMessageIndex("abc", 0, 100)).toEqual(0);
        });
        test("where we have multiple gaps including the beginning", () => {
            markRead.markRangeRead("abc", 20, 40);
            markRead.markRangeRead("abc", 50, 60);
            markRead.markRangeRead("abc", 70, 80);
            expect(markRead.getFirstUnreadMessageIndex("abc", 0, 100)).toEqual(0);
        });
        test("where we have multiple gaps after the beginning", () => {
            markRead.markRangeRead("abc", 0, 40);
            markRead.markRangeRead("abc", 50, 60);
            markRead.markRangeRead("abc", 70, 80);
            expect(markRead.getFirstUnreadMessageIndex("abc", 0, 100)).toEqual(41);
        });
        test("where the first message index is greater than 0", () => {
            markRead.markRangeRead("abc", 20, 40);
            markRead.markRangeRead("abc", 50, 60);
            markRead.markRangeRead("abc", 70, 80);
            expect(markRead.getFirstUnreadMessageIndex("abc", 10, 100)).toEqual(10);
        });
    });
});
