/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { DirectChatSummary } from "../domain/chat/chat";
import type { ServiceContainer } from "../services/serviceContainer";
import { ChatContext, chatMachine } from "./chat.machine";
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

const testContext: ChatContext = {
    serviceContainer: {} as ServiceContainer,
    chatSummary: directChat,
    userLookup: {},
    messages: [],
    latestMessageIndex: 0,
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
