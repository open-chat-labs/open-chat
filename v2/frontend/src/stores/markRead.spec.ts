import { initMarkRead, waiting } from "./markRead";
import { unconfirmed } from "./unconfirmed";

describe("mark messages read", () => {
    const api = {
        markMessagesRead: jest.fn(),
    };
    const markRead = initMarkRead(api);

    test("mark unconfirmed message as read", () => {
        unconfirmed.add(BigInt(100));
        markRead.markMessageRead("abc", 200, BigInt(100));
        expect(waiting.has(BigInt(100))).toBe(true);
    });
});
// describe("setting message read by me", () => {
//     test("where we have no messages read", () => {
//         expect(setMessageRead(defaultDirectChat, 10).readByMe).toEqual([{ from: 10, to: 10 }]);
//     });

//     test("where new index is within an existing range", () => {
//         const readByMe = setMessageRead(
//             {
//                 ...defaultDirectChat,
//                 readByMe: [{ from: 20, to: 30 }],
//             },
//             25
//         ).readByMe;
//         expect(readByMe).toEqual([{ from: 20, to: 30 }]);
//     });

//     test("where new index is fully below all existing ranges", () => {
//         const readByMe = setMessageRead(
//             {
//                 ...defaultDirectChat,
//                 readByMe: [{ from: 20, to: 30 }],
//             },
//             10
//         ).readByMe;
//         expect(readByMe).toEqual([
//             { from: 10, to: 10 },
//             { from: 20, to: 30 },
//         ]);
//     });
//     test("where new index is contiguous with lower bound of existing range", () => {
//         const readByMe = setMessageRead(
//             {
//                 ...defaultDirectChat,
//                 readByMe: [{ from: 20, to: 30 }],
//             },
//             19
//         ).readByMe;
//         expect(readByMe).toEqual([{ from: 19, to: 30 }]);
//     });
//     test("where new index is contiguous with upper bound of existing range", () => {
//         const readByMe = setMessageRead(
//             {
//                 ...defaultDirectChat,
//                 readByMe: [{ from: 20, to: 30 }],
//             },
//             31
//         ).readByMe;
//         expect(readByMe).toEqual([{ from: 20, to: 31 }]);
//     });
//     test("where new index is beyond final range", () => {
//         const readByMe = setMessageRead(
//             {
//                 ...defaultDirectChat,
//                 readByMe: [{ from: 20, to: 30 }],
//             },
//             35
//         ).readByMe;
//         expect(readByMe).toEqual([
//             { from: 20, to: 30 },
//             { from: 35, to: 35 },
//         ]);
//     });
//     test("where new index is between existing ranges", () => {
//         const readByMe = setMessageRead(
//             {
//                 ...defaultDirectChat,
//                 readByMe: [
//                     { from: 0, to: 10 },
//                     { from: 20, to: 30 },
//                 ],
//             },
//             15
//         ).readByMe;
//         expect(readByMe).toEqual([
//             { from: 0, to: 10 },
//             { from: 15, to: 15 },
//             { from: 20, to: 30 },
//         ]);
//     });
// });

// describe("getting unread message counts", () => {
//     describe("for a direct chat", () => {
//         test("with no latest message", () => {
//             expect(
//                 getUnreadMessages({
//                     ...defaultDirectChat,
//                     latestMessage: undefined,
//                 })
//             ).toEqual(0);
//         });
//         test("with no messages read", () => {
//             expect(
//                 getUnreadMessages({
//                     ...defaultDirectChat,
//                     readByMe: [],
//                 })
//             ).toEqual(101);
//         });
//         test("with no gaps", () => {
//             expect(
//                 getUnreadMessages({
//                     ...defaultDirectChat,
//                     readByMe: [{ from: 0, to: 100 }],
//                 })
//             ).toEqual(0);
//         });
//         test("with gap at the beginning", () => {
//             expect(
//                 getUnreadMessages({
//                     ...defaultDirectChat,
//                     readByMe: [{ from: 10, to: 100 }],
//                 })
//             ).toEqual(10);
//         });
//         test("with gaps at both ends", () => {
//             expect(
//                 getUnreadMessages({
//                     ...defaultDirectChat,
//                     readByMe: [{ from: 10, to: 90 }],
//                 })
//             ).toEqual(20);
//         });
//         test("with multiple gaps", () => {
//             expect(
//                 getUnreadMessages({
//                     ...defaultDirectChat,
//                     readByMe: [
//                         { from: 10, to: 30 }, // gap of 9
//                         { from: 40, to: 50 }, // gap of 9
//                         { from: 60, to: 70 }, // gap of 30
//                     ],
//                 })
//             ).toEqual(58);
//         });
//     });

//     describe("for a group chat", () => {
//         test("with no latest message", () => {
//             expect(
//                 getUnreadMessages({
//                     ...groupChatWithMessage,
//                     latestMessage: undefined,
//                 })
//             ).toEqual(0);
//         });
//         test("with no gaps", () => {
//             expect(
//                 getUnreadMessages({
//                     ...groupChatWithMessage,
//                     readByMe: [{ from: 0, to: 100 }],
//                 })
//             ).toEqual(0);
//         });
//         test("with gap at the beginning before min", () => {
//             expect(
//                 getUnreadMessages({
//                     ...groupChatWithMessage,
//                     readByMe: [{ from: 10, to: 100 }],
//                 })
//             ).toEqual(0);
//         });
//         test("with gap at the beginning after min", () => {
//             expect(
//                 getUnreadMessages({
//                     ...groupChatWithMessage,
//                     readByMe: [{ from: 30, to: 100 }],
//                 })
//             ).toEqual(10);
//         });
//         test("with gaps at both ends", () => {
//             expect(
//                 getUnreadMessages({
//                     ...groupChatWithMessage,
//                     readByMe: [{ from: 30, to: 90 }],
//                 })
//             ).toEqual(20);
//         });
//         test("with multiple gaps", () => {
//             expect(
//                 getUnreadMessages({
//                     ...groupChatWithMessage,
//                     readByMe: [
//                         { from: 10, to: 30 }, // gap of 9
//                         { from: 40, to: 50 }, // gap of 9
//                         { from: 60, to: 70 }, // gap of 30
//                     ],
//                 })
//             ).toEqual(48);
//         });
//     });
// });
