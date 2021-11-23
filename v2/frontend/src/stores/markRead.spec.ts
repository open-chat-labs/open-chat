import { MessageReadTracker } from "./markRead";
import { unconfirmed } from "./unconfirmed";

describe("mark messages read", () => {
    const api = {
        markMessagesRead: jest.fn(),
    };
    const markRead = new MessageReadTracker(api);

    beforeEach(() => {
        jest.useFakeTimers();
        unconfirmed.clear();
        if (markRead.waiting["abc"] !== undefined) {
            markRead.waiting["abc"].clear();
        }
        markRead.state["abc"] = [];
        markRead.serverState["abc"] = [];
        markRead.syncStore();
    });

    test("mark unconfirmed message as read", () => {
        unconfirmed.add(BigInt(100));
        markRead.markMessageRead("abc", 200, BigInt(100));
        expect(markRead.waiting["abc"].has(BigInt(100))).toBe(true);
    });

    test("mark confirmed message as read", () => {
        markRead.state["abc"] = [{ from: 199, to: 199 }];
        markRead.markMessageRead("abc", 200, BigInt(500));
        expect(markRead.waiting["abc"].has(BigInt(500))).toBe(false);
        expect(markRead.state["abc"]).toEqual([{ from: 199, to: 200 }]);
    });

    test("confirm message", () => {
        markRead.waiting["abc"].add(BigInt(100));
        markRead.markMessageRead("abc", 200, BigInt(100));
        markRead.confirmMessage("abc", 200, BigInt(100));
        expect(markRead.waiting["abc"].has(BigInt(100))).toBe(false);
        expect(markRead.state["abc"]).toEqual([{ from: 200, to: 200 }]);
    });

    describe("unread message count", () => {
        describe("when all messages are confirmed", () => {
            test("with no latest message + waiting local messages", () => {
                markRead.waiting["abc"].add(BigInt(0));
                markRead.waiting["abc"].add(BigInt(1));
                markRead.waiting["abc"].add(BigInt(2));
                expect(markRead.unreadMessageCount("abc", 0, undefined)).toEqual(0);
            });
            test("with no latest message", () => {
                expect(markRead.unreadMessageCount("abc", 0, undefined)).toEqual(0);
            });
            test("with no messages read", () => {
                expect(markRead.unreadMessageCount("abc", 0, 100)).toEqual(101);
            });
            test("with no gaps", () => {
                markRead.serverState["abc"] = [{ from: 0, to: 50 }];
                markRead.state["abc"] = [{ from: 51, to: 100 }];
                expect(markRead.unreadMessageCount("abc", 0, 100)).toEqual(0);
            });
            test("with gap at the beginning", () => {
                markRead.serverState["abc"] = [{ from: 10, to: 50 }];
                markRead.state["abc"] = [{ from: 51, to: 100 }];
                expect(markRead.unreadMessageCount("abc", 0, 100)).toEqual(10);
            });
            test("with gaps at both ends", () => {
                markRead.serverState["abc"] = [{ from: 10, to: 50 }];
                markRead.state["abc"] = [{ from: 51, to: 90 }];
                expect(markRead.unreadMessageCount("abc", 0, 100)).toEqual(20);
            });
            test("with multiple gaps", () => {
                markRead.serverState["abc"] = [{ from: 10, to: 30 }];
                markRead.state["abc"] = [
                    { from: 40, to: 50 },
                    { from: 60, to: 70 },
                ];
                expect(markRead.unreadMessageCount("abc", 0, 100)).toEqual(58);
            });
        });
        describe("when some messages are unconfirmed", () => {
            test("with multiple gaps", () => {
                markRead.waiting["abc"].add(BigInt(0));
                markRead.waiting["abc"].add(BigInt(1));
                markRead.waiting["abc"].add(BigInt(2));
                markRead.waiting["abc"].add(BigInt(3));
                markRead.serverState["abc"] = [{ from: 10, to: 30 }];
                markRead.state["abc"] = [
                    { from: 40, to: 50 },
                    { from: 60, to: 70 },
                ];
                expect(markRead.unreadMessageCount("abc", 0, 100)).toEqual(54);
            });
        });
    });
});
