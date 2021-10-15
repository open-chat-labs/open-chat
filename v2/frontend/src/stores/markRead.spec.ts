import { initMarkRead, serverState, state, waiting } from "./markRead";
import { unconfirmed } from "./unconfirmed";

describe("mark messages read", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        unconfirmed.clear();
        if (waiting["abc"] !== undefined) {
            waiting["abc"].clear();
        }
        state["abc"] = [];
        serverState["abc"] = [];
    });

    const api = {
        markMessagesRead: jest.fn(),
    };
    const markRead = initMarkRead(api);

    test("mark unconfirmed message as read", () => {
        unconfirmed.add(BigInt(100));
        markRead.markMessageRead("abc", 200, BigInt(100));
        expect(waiting["abc"].has(BigInt(100))).toBe(true);
    });

    test("mark confirmed message as read", () => {
        state["abc"] = [{ from: 199, to: 199 }];
        markRead.markMessageRead("abc", 200, BigInt(500));
        expect(waiting["abc"].has(BigInt(500))).toBe(false);
        expect(state["abc"]).toEqual([{ from: 199, to: 200 }]);
    });

    test("confirm message", () => {
        waiting["abc"].add(BigInt(100));
        markRead.markMessageRead("abc", 200, BigInt(100));
        markRead.confirmMessage("abc", 200, BigInt(100));
        expect(waiting["abc"].has(BigInt(100))).toBe(false);
        expect(state["abc"]).toEqual([{ from: 200, to: 200 }]);
    });

    describe("unread message count", () => {
        describe("when all messages are confirmed", () => {
            test("with no latest message", () => {
                expect(markRead.unreadMessageCount("abc", 0, undefined)).toEqual(0);
            });
            test("with no messages read", () => {
                expect(markRead.unreadMessageCount("abc", 0, 100)).toEqual(101);
            });
            test("with no gaps", () => {
                serverState["abc"] = [{ from: 0, to: 50 }];
                state["abc"] = [{ from: 51, to: 100 }];
                expect(markRead.unreadMessageCount("abc", 0, 100)).toEqual(0);
            });
            test("with gap at the beginning", () => {
                serverState["abc"] = [{ from: 10, to: 50 }];
                state["abc"] = [{ from: 51, to: 100 }];
                expect(markRead.unreadMessageCount("abc", 0, 100)).toEqual(10);
            });
            test("with gaps at both ends", () => {
                serverState["abc"] = [{ from: 10, to: 50 }];
                state["abc"] = [{ from: 51, to: 90 }];
                expect(markRead.unreadMessageCount("abc", 0, 100)).toEqual(20);
            });
            test("with multiple gaps", () => {
                serverState["abc"] = [{ from: 10, to: 30 }];
                state["abc"] = [
                    { from: 40, to: 50 },
                    { from: 60, to: 70 },
                ];
                expect(markRead.unreadMessageCount("abc", 0, 100)).toEqual(58);
            });
        });
        describe("when some messages are unconfirmed", () => {
            test("with multiple gaps", () => {
                waiting["abc"].add(BigInt(0));
                waiting["abc"].add(BigInt(1));
                waiting["abc"].add(BigInt(2));
                waiting["abc"].add(BigInt(3));
                serverState["abc"] = [{ from: 10, to: 30 }];
                state["abc"] = [
                    { from: 40, to: 50 },
                    { from: 60, to: 70 },
                ];
                expect(markRead.unreadMessageCount("abc", 0, 100)).toEqual(54);
            });
        });
    });
});
