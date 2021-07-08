/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { DirectChatSummary } from "../domain/chat/chat";
import { homeMachine } from "./home.machine";
import { testTransition } from "./machine.spec.utils";

const directChat: DirectChatSummary = {
    kind: "direct_chat",
    them: "abcdefg",
    chatId: BigInt(123),
    lastUpdated: BigInt(0),
    displayDate: BigInt(0),
    lastReadByUs: 0,
    lastReadByThem: 0,
    lastestMessageId: 5,
    latestMessage: undefined,
};

describe("home machine transitions", () => {
    test("getChats fails", () => {
        testTransition(homeMachine, "loading_chats", "error.platform.getChats", "unexpected_error");
    });
    test("getChats succeeds", () => {
        testTransition(
            homeMachine,
            "loading_chats",
            {
                type: "done.invoke.getChats",
                data: {
                    chats: [],
                    chatsTimestamp: BigInt(0),
                    userLookup: {},
                    usersTimestamp: BigInt(0),
                },
            },
            { loaded_chats: "no_chat_selected" }
        );
    });
    test("trigger load messages", () => {
        testTransition(
            homeMachine.withContext({
                chats: [directChat],
                userLookup: {},
                chatsTimestamp: BigInt(0),
                usersTimestamp: BigInt(0),
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
        const ctx = testTransition(
            homeMachine.withContext({
                chats: [directChat],
                userLookup: {},
                chatsTimestamp: BigInt(0),
                usersTimestamp: BigInt(0),
                selectedChat: directChat,
            }),
            { loaded_chats: "no_chat_selected" },
            "CLEAR_SELECTED_CHAT",
            {
                loaded_chats: "no_chat_selected",
            }
        );

        expect(ctx.selectedChat).toBe(undefined);
    });

    test("users updated - updates context", () => {
        const ctx = testTransition(
            homeMachine,
            { loaded_chats: "no_chat_selected" },
            {
                type: "USERS_UPDATED",
                data: {
                    userLookup: {
                        "123": { userId: "123", username: "me", secondsSinceLastOnline: 10 },
                    },
                    usersTimestamp: BigInt(100),
                },
            },
            {
                loaded_chats: "no_chat_selected",
            }
        );

        expect(ctx.usersTimestamp).toBe(BigInt(100));
        expect(ctx.userLookup["123"].username).toBe("me");
    });

    test("chats updated - updates context", () => {
        const ctx = testTransition(
            homeMachine,
            { loaded_chats: "no_chat_selected" },
            {
                type: "CHATS_UPDATED",
                data: {
                    chats: [directChat],
                    chatsTimestamp: BigInt(200),
                    userLookup: {
                        "123": { userId: "123", username: "me", secondsSinceLastOnline: 10 },
                    },
                    usersTimestamp: BigInt(100),
                },
            },
            {
                loaded_chats: "no_chat_selected",
            }
        );

        expect(ctx.usersTimestamp).toBe(BigInt(100));
        expect(ctx.userLookup["123"].username).toBe("me");
        expect(ctx.chats[0]).toEqual(directChat);
        expect(ctx.chatsTimestamp).toBe(BigInt(200));
    });
});
