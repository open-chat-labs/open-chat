/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { DirectChatSummary, GroupChatSummary, Message } from "../domain/chat/chat";
import type { ServiceContainer } from "../services/serviceContainer";
import { ChatContext, chatMachine, newMessagesRange, previousMessagesRange } from "./chat.machine";
import { testTransition } from "./machine.spec.utils";

const directChat: DirectChatSummary = {
    kind: "direct_chat",
    them: "abcdefg",
    chatId: "abcdefg",
    lastUpdated: BigInt(0),
    latestReadByMe: 0,
    latestReadByThem: 0,
    latestMessage: undefined,
};

const groupChat: GroupChatSummary = {
    kind: "group_chat",
    name: "this is a group chat",
    description: "this is a group chat",
    public: true,
    joined: BigInt(0),
    minVisibleMessageIndex: 0,
    chatId: "abcdef",
    lastUpdated: BigInt(0),
    latestReadByMe: 0,
    latestMessage: undefined,
    participants: [],
};

const testContext: ChatContext = {
    serviceContainer: {} as ServiceContainer,
    chatSummary: directChat,
    userLookup: {},
    messages: [],
    user: {
        userId: "abcdef",
        username: "julian_jelfs",
        secondsSinceLastOnline: 10,
    },
};

describe("chat machine transitions", () => {
    test("initiate loading previous messages", () => {
        testTransition(
            chatMachine.withContext(testContext),
            { user_states: "idle" },
            { type: "LOAD_PREVIOUS_MESSAGES" },
            { user_states: "loading_previous_messages" }
        );
    });
    test("send messages", () => {
        const ctx = testTransition(
            chatMachine.withContext(testContext),
            { user_states: "idle" },
            { type: "SEND_MESSAGE", data: "hello world" },
            { user_states: "sending_message" }
        );
        expect(ctx.messages.length).toEqual(1);
    });
    test("show participants", () => {
        testTransition(
            chatMachine.withContext(testContext),
            { user_states: "idle" },
            { type: "SHOW_PARTICIPANTS" },
            { user_states: "showing_participants" }
        );
    });
    test("add participants", () => {
        testTransition(
            chatMachine.withContext(testContext),
            { user_states: "idle" },
            { type: "ADD_PARTICIPANT" },
            { user_states: "showing_participants" }
        );
    });
    test("clear focus index", () => {
        const ctx = testTransition(
            chatMachine.withContext({ ...testContext, focusIndex: 123 }),
            { user_states: "idle" },
            { type: "CLEAR_FOCUS_INDEX" },
            { user_states: "idle" }
        );
        expect(ctx.focusIndex).toBe(undefined);
    });
    test("clear focus index", () => {
        const ctx = testTransition(
            chatMachine.withContext(testContext),
            { user_states: "idle" },
            { type: "GO_TO_MESSAGE_INDEX", data: 123 },
            { user_states: "loading_previous_messages" }
        );
        expect(ctx.focusIndex).toBe(123);
    });
});

function textMessage(index: number): Message {
    return {
        messageId: BigInt(index),
        messageIndex: index,
        content: {
            kind: "text_content",
            text: "some text",
        },
        sender: "abcdefg",
        timestamp: BigInt(+new Date()),
        repliesTo: undefined,
    };
}

describe("required message range calculation", () => {
    describe("updating chats", () => {
        /**
         * from: latestMessageIndexLoaded
         * to: latestMessage?.messageIndex
         *
         * if there are no messages loaded then we should not be loading updates so do nothing
         * if there is no latest message then there cannot be anything to load so do nothing
         */
        test("from equals to", () => {
            const ctx = {
                ...testContext,
                messages: [textMessage(100)],
                chatSummary: { ...directChat, latestMessage: textMessage(101) },
            };
            expect(newMessagesRange(ctx)).toEqual([101, 101]);
        });
        test("from greater than to", () => {
            // this is not really a valid scenario, but we should deal with it
            const ctx = {
                ...testContext,
                messages: [textMessage(200)],
                chatSummary: { ...directChat, latestMessage: textMessage(101) },
            };
            expect(newMessagesRange(ctx)).toBe(undefined);
        });
        test("no messages loaded", () => {
            expect(newMessagesRange(testContext)).toBe(undefined);
        });
        test("no latest message on chat", () => {
            const ctx = {
                ...testContext,
                messages: [textMessage(200)],
            };
            expect(newMessagesRange(ctx)).toBe(undefined);
        });
        test("normal scenario", () => {
            const ctx = {
                ...testContext,
                messages: [textMessage(100)],
                chatSummary: { ...directChat, latestMessage: textMessage(110) },
            };
            expect(newMessagesRange(ctx)).toEqual([101, 110]);
        });
    });

    describe("loading previous chats", () => {
        describe("when we have not loaded any chats", () => {
            test("cannot go back beyond zero for direct chat", () => {
                const ctx = {
                    ...testContext,
                    chatSummary: { ...directChat, latestMessage: textMessage(9) },
                };
                expect(previousMessagesRange(ctx)).toEqual([0, 9]);
            });
            test("cannot go back beyond min index for group chat", () => {
                const ctx: ChatContext = {
                    ...testContext,
                    chatSummary: {
                        ...groupChat,
                        minVisibleMessageIndex: 90,
                        latestMessage: textMessage(100),
                    },
                };
                expect(previousMessagesRange(ctx)).toEqual([90, 100]);
            });
            test("takes into account focus index", () => {
                // should go to focusIndex - page_size
                const ctx: ChatContext = {
                    ...testContext,
                    focusIndex: 70,
                    chatSummary: { ...directChat, latestMessage: textMessage(100) },
                };
                expect(previousMessagesRange(ctx)).toEqual([50, 100]);
            });
            test("limited by page size if nothing else", () => {
                const ctx: ChatContext = {
                    ...testContext,
                    chatSummary: { ...directChat, latestMessage: textMessage(100) },
                };
                expect(previousMessagesRange(ctx)).toEqual([80, 100]);
            });
        });

        describe("when we have already got some chats", () => {
            test("cannot go back beyond zero for direct chat", () => {
                const ctx = {
                    ...testContext,
                    messages: [textMessage(10)],
                };
                expect(previousMessagesRange(ctx)).toEqual([0, 9]);
            });
            test("cannot go back beyond min index for group chat", () => {
                const ctx: ChatContext = {
                    ...testContext,
                    messages: [textMessage(101)],
                    chatSummary: {
                        ...groupChat,
                        minVisibleMessageIndex: 90,
                    },
                };
                expect(previousMessagesRange(ctx)).toEqual([90, 100]);
            });
            test("takes into account focus index", () => {
                // should go to focusIndex - page_size
                const ctx: ChatContext = {
                    ...testContext,
                    messages: [textMessage(101)],
                    focusIndex: 70,
                    chatSummary: { ...directChat },
                };
                expect(previousMessagesRange(ctx)).toEqual([50, 100]);
            });
            test("limited by page size if nothing else", () => {
                const ctx: ChatContext = {
                    ...testContext,
                    messages: [textMessage(101)],
                    chatSummary: { ...directChat },
                };
                expect(previousMessagesRange(ctx)).toEqual([80, 100]);
            });
        });
    });
});
