/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { Identity } from "@dfinity/agent";
import type {
    DirectChatSummary,
    Message,
    EnhancedReplyContext,
    EventWrapper,
    FileContent,
    GroupChatSummary,
    TextContent,
} from "../domain/chat/chat";
import { newMessageId } from "../domain/chat/chat.utils";
import { GroupIndexClient } from "../services/groupIndex/groupIndex.client";
import { ServiceContainer } from "../services/serviceContainer";
import { UserIndexClient } from "../services/userIndex/userIndex.client";
import { fakeMessageReadTracker } from "../stores/markRead";
import {
    ChatContext,
    chatMachine,
    newMessageCriteria,
    previousMessagesCriteria,
} from "./chat.machine";
import { testTransition } from "./machine.spec.utils";

const textMessageContent: TextContent = {
    kind: "text_content",
    text: "This is a message",
};

const fileMessageContent: FileContent = {
    kind: "file_content",
    name: "stuff_in_a_file.pdf",
    blobData: undefined,
    mimeType: "file/pdf",
    fileSize: 10000,
};

const testDirectMessage: Message = {
    kind: "message",
    sender: "abcdefg",
    repliesTo: undefined,
    messageId: newMessageId(),
    messageIndex: 100,
    content: textMessageContent,
    reactions: [],
    edited: false,
};

const directChat: DirectChatSummary = {
    kind: "direct_chat",
    them: "abcdefg",
    chatId: "abcdefg",
    readByMe: [],
    readByThem: [],
    latestMessage: undefined,
    latestEventIndex: 0,
    dateCreated: BigInt(0),
};

const groupChat: GroupChatSummary = {
    kind: "group_chat",
    name: "this is a group chat",
    description: "this is a group chat",
    public: true,
    joined: BigInt(0),
    minVisibleEventIndex: 0,
    minVisibleMessageIndex: 0,
    chatId: "abcdef",
    lastUpdated: BigInt(0),
    readByMe: [],
    latestMessage: undefined,
    participants: [],
    latestEventIndex: 0,
};

const directContext: ChatContext = {
    serviceContainer: {} as ServiceContainer,
    chatSummary: directChat,
    events: [],
    user: {
        userId: "abcdef",
        username: "julian_jelfs",
        secondsSinceLastOnline: 10,
    },
    replyingTo: undefined,
    localReactions: {},
    markRead: fakeMessageReadTracker,
    initialised: false,
};

GroupIndexClient.create = jest.fn();
UserIndexClient.create = jest.fn();
const serviceContainer = new ServiceContainer({} as Identity);

const groupContext: ChatContext = {
    serviceContainer,
    chatSummary: groupChat,
    events: [],
    user: {
        userId: "abcdef",
        username: "julian_jelfs",
        secondsSinceLastOnline: 10,
    },
    replyingTo: undefined,
    localReactions: {},
    markRead: fakeMessageReadTracker,
    initialised: false,
};

describe("chat machine transitions", () => {
    describe("attaching files", () => {
        test("attach non file content", () => {
            const ctx = testTransition(
                chatMachine.withContext(directContext),
                { user_states: "idle" },
                { type: "ATTACH_FILE", data: textMessageContent },
                { user_states: "idle" }
            );
            expect(ctx.fileToAttach).toEqual(textMessageContent);
        });

        test("clear attached file", () => {
            const ctx = testTransition(
                chatMachine.withContext({ ...directContext, fileToAttach: textMessageContent }),
                { user_states: "idle" },
                { type: "CLEAR_ATTACHMENT" },
                { user_states: "idle" }
            );
            expect(ctx.fileToAttach).toBe(undefined);
        });

        test("attach file content", () => {
            // todo - this doesn't really test that the send message event is sent
            const ctx = testTransition(
                chatMachine.withContext(directContext),
                { user_states: "idle" },
                { type: "ATTACH_FILE", data: fileMessageContent },
                { user_states: "idle" }
            );
            expect(ctx.fileToAttach).toEqual(fileMessageContent);
        });
    });

    test("initiate loading previous messages", () => {
        testTransition(
            chatMachine.withContext(directContext),
            { user_states: "idle" },
            { type: "LOAD_PREVIOUS_MESSAGES" },
            { user_states: "loading_previous_messages" }
        );
    });
    test("reply to", () => {
        const msg = repliesTo();
        const ctx = testTransition(
            chatMachine.withContext(directContext),
            { user_states: "idle" },
            { type: "REPLY_TO", data: msg },
            { user_states: "idle" }
        );
        expect(ctx.replyingTo).toEqual(msg);
    });
    test("send messages", () => {
        const ctx = testTransition(
            chatMachine.withContext(groupContext),
            { user_states: "idle" },
            {
                type: "SEND_MESSAGE",
                data: {
                    messageEvent: {
                        event: testDirectMessage,
                        index: 100,
                        timestamp: BigInt(+new Date()),
                    },
                    userId: "abcdefg",
                },
            },
            { user_states: "idle" }
        );
        expect(ctx.events.length).toEqual(1);
        expect(ctx.events[0].event).toEqual(testDirectMessage);
    });
    test("update message", () => {
        const ctx = testTransition(
            chatMachine.withContext({
                ...directContext,
                events: [
                    {
                        event: testDirectMessage,
                        timestamp: BigInt(0),
                        index: 100,
                    },
                ],
            }),
            { user_states: "idle" },
            {
                type: "UPDATE_MESSAGE",
                data: {
                    candidate: testDirectMessage,
                    resp: {
                        kind: "success",
                        timestamp: BigInt(100),
                        messageIndex: 200,
                        eventIndex: 200,
                    },
                },
            },
            { user_states: "idle" }
        );
        expect(ctx.events.length).toEqual(1);
        expect(ctx.events[0].event).toMatchObject({
            messageIndex: 200,
        });
    });
    test("remove message", () => {
        const ctx = testTransition(
            chatMachine.withContext({
                ...directContext,
                events: [
                    {
                        event: testDirectMessage,
                        timestamp: BigInt(0),
                        index: 100,
                    },
                ],
            }),
            { user_states: "idle" },
            {
                type: "REMOVE_MESSAGE",
                data: { messageId: testDirectMessage.messageId, userId: testDirectMessage.sender },
            },
            { user_states: "idle" }
        );
        expect(ctx.events.length).toEqual(0);
    });
    test("cancel reply to", () => {
        const ctx = testTransition(
            chatMachine.withContext({ ...directContext, replyingTo: repliesTo() }),
            { user_states: "idle" },
            { type: "CANCEL_REPLY_TO" },
            { user_states: "idle" }
        );
        expect(ctx.replyingTo).toBe(undefined);
    });
    test("send messages clears replyto", () => {
        // todo - temporary hack, I will revisit this
        serviceContainer.sendMessage = jest
            .fn()
            .mockResolvedValue({ kind: "send_message_too_long" });
        const ctx = testTransition(
            chatMachine.withContext({ ...groupContext, replyingTo: repliesToGroup() }),
            { user_states: "idle" },
            {
                type: "SEND_MESSAGE",
                data: {
                    messageEvent: {
                        event: testDirectMessage,
                        index: 100,
                        timestamp: BigInt(+new Date()),
                    },
                    userId: "abcdefg",
                },
            },
            { user_states: "idle" }
        );
        expect(ctx.replyingTo).toBe(undefined);
    });
    test("show participants", () => {
        testTransition(
            chatMachine.withContext(groupContext),
            { user_states: "idle" },
            { type: "SHOW_GROUP_DETAILS" },
            { user_states: "showing_group" }
        );
    });
    test("add participants", () => {
        testTransition(
            chatMachine.withContext(groupContext),
            { user_states: "idle" },
            { type: "ADD_PARTICIPANT" },
            { user_states: "showing_group" }
        );
    });
    test("clear focus index", () => {
        const ctx = testTransition(
            chatMachine.withContext({ ...directContext, focusIndex: 123 }),
            { user_states: "idle" },
            { type: "CLEAR_FOCUS_INDEX" },
            { user_states: "idle" }
        );
        expect(ctx.focusIndex).toBe(undefined);
    });
    test("clear focus index", () => {
        const ctx = testTransition(
            chatMachine.withContext(directContext),
            { user_states: "idle" },
            { type: "GO_TO_EVENT_INDEX", data: 123 },
            { user_states: "loading_previous_messages" }
        );
        expect(ctx.focusIndex).toBe(123);
    });
});

function eventMessage(index: number): EventWrapper<Message> {
    return {
        event: textMessage(index),
        index,
        timestamp: BigInt(+new Date()),
    };
}

function repliesTo(): EnhancedReplyContext {
    return {
        kind: "rehydrated_reply_context",
        content: {
            kind: "text_content",
            text: "some text",
        },
        senderId: "abcdefg",
        eventIndex: 0,
        messageId: newMessageId(),
        chatId: "chatId",
    };
}

function repliesToGroup(): EnhancedReplyContext {
    return {
        kind: "rehydrated_reply_context",
        content: {
            kind: "text_content",
            text: "some text",
        },
        senderId: "abcdef",
        eventIndex: 0,
        messageId: newMessageId(),
        chatId: "chatId",
    };
}

function textMessage(index: number): Message {
    return {
        kind: "message",
        content: {
            kind: "text_content",
            text: "some text",
        },
        sender: "abcdef",
        repliesTo: undefined,
        messageId: newMessageId(),
        messageIndex: index,
        reactions: [],
        edited: false,
    };
}

describe("required message range calculation", () => {
    describe("updating chats", () => {
        test("from equals to", () => {
            const ctx = {
                ...directContext,
                events: [eventMessage(100)],
                chatSummary: {
                    ...directChat,
                    latestMessage: eventMessage(101),
                    latestEventIndex: 101,
                },
            };
            expect(newMessageCriteria(ctx)).toEqual([101, true]);
        });
        test("from greater than to", () => {
            // this is not really a valid scenario, but we should deal with it
            const ctx = {
                ...directContext,
                events: [eventMessage(200)],
                chatSummary: {
                    ...directChat,
                    latestMessage: eventMessage(101),
                    latestEventIndex: 101,
                },
            };
            expect(newMessageCriteria(ctx)).toBe(undefined);
        });
        test("no messages loaded", () => {
            expect(newMessageCriteria(directContext)).toBe(undefined);
        });
        test("no latest message on chat", () => {
            const ctx = {
                ...directContext,
                events: [eventMessage(200)],
            };
            expect(newMessageCriteria(ctx)).toBe(undefined);
        });
        test("normal scenario", () => {
            const ctx = {
                ...directContext,
                events: [eventMessage(100)],
                chatSummary: {
                    ...directChat,
                    latestMessage: eventMessage(110),
                    latestEventIndex: 110,
                },
            };
            expect(newMessageCriteria(ctx)).toEqual([101, true]);
        });
    });

    describe("loading previous chats", () => {
        describe("when we have not loaded any chats", () => {
            test("cannot go back beyond zero for direct chat", () => {
                const ctx = {
                    ...directContext,
                    chatSummary: {
                        ...directChat,
                        latestMessage: eventMessage(9),
                        latestEventIndex: 9,
                    },
                };
                expect(previousMessagesCriteria(ctx)).toEqual([9, false]);
            });
            test("cannot go back beyond min index for group chat", () => {
                const ctx: ChatContext = {
                    ...groupContext,
                    chatSummary: {
                        ...groupChat,
                        minVisibleEventIndex: 90,
                        latestMessage: eventMessage(100),
                        latestEventIndex: 100,
                    },
                };
                expect(previousMessagesCriteria(ctx)).toEqual([100, false]);
            });
        });

        describe("when we have already got some chats", () => {
            test("cannot go back beyond zero for direct chat", () => {
                const ctx = {
                    ...directContext,
                    events: [eventMessage(10)],
                };
                expect(previousMessagesCriteria(ctx)).toEqual([9, false]);
            });
            test("cannot go back beyond min index for group chat", () => {
                const ctx: ChatContext = {
                    ...directContext,
                    events: [eventMessage(101)],
                    chatSummary: {
                        ...groupChat,
                        minVisibleEventIndex: 90,
                    },
                };
                expect(previousMessagesCriteria(ctx)).toEqual([100, false]);
            });
        });
    });
});
