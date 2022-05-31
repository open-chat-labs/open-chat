import DRange from "drange";
import { MessageReadTracker } from "./markRead";
import { unconfirmed } from "./unconfirmed";
import { rangesAreEqual } from "../domain/chat/chat.utils";
import type { EventWrapper, Message } from "../domain/chat/chat";

describe("mark messages read", () => {
    const api = {
        markMessagesRead: jest.fn(),
    };
    const markRead = new MessageReadTracker(api);

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
        markRead.state["abc"] = new DRange();
        markRead.serverState["abc"] = new DRange();
        markRead.publish();
    });

    test("mark unconfirmed message as read", () => {
        unconfirmed.add("abc", createDummyMessage(BigInt(100)));
        markRead.markMessageRead("abc", 200, BigInt(100));
        expect(markRead.waiting["abc"].has(BigInt(100))).toBe(true);
    });

    test("mark confirmed message as read", () => {
        markRead.state["abc"] = new DRange(199, 199);
        markRead.markMessageRead("abc", 200, BigInt(500));
        expect(markRead.waiting["abc"].has(BigInt(500))).toBe(false);
        expect(rangesAreEqual(markRead.state["abc"], new DRange(199, 200)));
    });

    test("confirm message", () => {
        markRead.waiting["abc"].set(BigInt(100), 100);
        markRead.markMessageRead("abc", 200, BigInt(100));
        markRead.confirmMessage("abc", 200, BigInt(100));
        expect(markRead.waiting["abc"].has(BigInt(100))).toBe(false);
        expect(rangesAreEqual(markRead.state["abc"], new DRange(200, 200)));
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
                markRead.serverState["abc"] = new DRange(0, 50);
                markRead.state["abc"] = new DRange(51, 100);
                expect(markRead.unreadMessageCount("abc", 0, 100)).toEqual(0);
            });
            test("with gap at the beginning", () => {
                markRead.serverState["abc"] = new DRange(10, 50);
                markRead.state["abc"] = new DRange(51, 100);
                expect(markRead.unreadMessageCount("abc", 0, 100)).toEqual(10);
            });
            test("with gaps at both ends", () => {
                markRead.serverState["abc"] = new DRange(10, 50);
                markRead.state["abc"] = new DRange(51, 90);
                expect(markRead.unreadMessageCount("abc", 0, 100)).toEqual(20);
            });
            test("with multiple gaps", () => {
                markRead.serverState["abc"] = new DRange(10, 30);
                markRead.state["abc"] = new DRange(40, 50).add(60, 70);
                expect(markRead.unreadMessageCount("abc", 0, 100)).toEqual(58);
            });
        });
        describe("when some messages are unconfirmed", () => {
            test("with multiple gaps", () => {
                markRead.waiting["abc"].set(BigInt(0), 0);
                markRead.waiting["abc"].set(BigInt(1), 1);
                markRead.waiting["abc"].set(BigInt(2), 2);
                markRead.waiting["abc"].set(BigInt(3), 3);
                markRead.serverState["abc"] = new DRange(10, 30);
                markRead.state["abc"] = new DRange(40, 50).add(60, 70);
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
