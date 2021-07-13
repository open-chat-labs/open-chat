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
    displayDate: BigInt(0),
    lastReadByUs: 0,
    lastReadByThem: 0,
    lastestMessageIndex: 5,
    latestMessage: undefined,
};

const testContext: ChatContext = {
    serviceContainer: {} as ServiceContainer,
    chatSummary: directChat,
    userLookup: {},
    messages: [],
};

describe("chat machine transitions", () => {
    test("load messages success", () => {
        testTransition(
            chatMachine.withContext(testContext),
            "loading_messages",
            "done.invoke.loadMessagesAndUsers",
            "loaded_messages"
        );
    });

    test("load messages failure", () => {
        testTransition(
            chatMachine.withContext(testContext),
            "loading_messages",
            "error.platform.loadMessagesAndUsers",
            "unexpected_error"
        );
    });

    test("show participants", () => {
        testTransition(
            chatMachine.withContext(testContext),
            "loaded_messages",
            "SHOW_PARTICIPANTS",
            { showing_participants: "idle" }
        );
    });

    test("add participants", () => {
        testTransition(chatMachine.withContext(testContext), "loaded_messages", "ADD_PARTICIPANT", {
            showing_participants: "adding_participant",
        });
    });

    test("cancel add participants", () => {
        testTransition(
            chatMachine.withContext(testContext),
            { showing_participants: "adding_participant" },
            "CANCEL_ADD_PARTICIPANT",
            { showing_participants: "idle" }
        );
    });

    test("user search completes", () => {
        testTransition(
            chatMachine.withContext(testContext),
            { showing_participants: "adding_participant" },
            "done.invoke.userSearchMachine",
            { showing_participants: "idle" }
        );
    });

    test.skip("user search throws error", () => {
        testTransition(
            chatMachine.withContext(testContext),
            { showing_participants: "adding_participant" },
            "error.platform.userSearchMachine",
            "unexpected_error"
        );
    });

    test("hide participants", () => {
        testTransition(
            chatMachine.withContext(testContext),
            { showing_participants: "adding_participant" },
            "HIDE_PARTICIPANTS",
            "loaded_messages"
        );
    });

    test("remove participant", () => {
        testTransition(
            chatMachine.withContext(testContext),
            { showing_participants: "idle" },
            "REMOVE_PARTICIPANT",
            { showing_participants: "removing_participant" }
        );
    });

    test("dismiss as admin", () => {
        testTransition(
            chatMachine.withContext(testContext),
            { showing_participants: "idle" },
            "DISMISS_AS_ADMIN",
            { showing_participants: "dismissing_participant" }
        );
    });

    test("add participant while showing", () => {
        testTransition(
            chatMachine.withContext(testContext),
            { showing_participants: "idle" },
            "ADD_PARTICIPANT",
            { showing_participants: "adding_participant" }
        );
    });
});
