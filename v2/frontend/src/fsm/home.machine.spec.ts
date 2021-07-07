/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { homeMachine } from "./home.machine";
import { testTransition } from "./machine.spec.utils";

describe("home machine transitions", () => {
    test("getChats fails", () => {
        testTransition(homeMachine, "loading_chats", "error.platform.getChats", "unexpected_error");
    });
    test("getChats succeeds", () => {
        testTransition(
            homeMachine,
            "loading_chats",
            { type: "done.invoke.getChats", data: { chats: [], users: [] } },
            { loaded_chats: "no_chat_selected" }
        );
    });
    test("trigger load messages", () => {
        testTransition(
            homeMachine.withContext({
                chats: [
                    {
                        kind: "direct_chat",
                        them: "abcdefg",
                        chatId: BigInt(123),
                        lastUpdated: BigInt(0),
                        displayDate: BigInt(0),
                        lastReadByUs: 0,
                        lastReadByThem: 0,
                        lastestMessageId: 5,
                        latestMessage: undefined,
                    },
                ],
                userLookup: {},
            }),
            { loaded_chats: "no_chat_selected" },
            { type: "LOAD_MESSAGES", data: BigInt(123) },
            {
                loaded_chats: "loading_messages",
            }
        );
    });
    test("trigger load messages - does nothing for invalid chat", () => {
        testTransition(
            homeMachine,
            { loaded_chats: "no_chat_selected" },
            { type: "LOAD_MESSAGES", data: BigInt(999) },
            {
                loaded_chats: "no_chat_selected",
            }
        );
    });
    test("clear selected chat", () => {
        testTransition(
            homeMachine.withContext({
                chats: [],
                userLookup: {},
            }),
            { loaded_chats: "no_chat_selected" },
            "CLEAR_SELECTED_CHAT",
            {
                loaded_chats: "no_chat_selected",
            }
        );
    });
});
