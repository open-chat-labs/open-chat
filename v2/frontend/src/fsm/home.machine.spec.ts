/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { DirectChatSummary, GroupChatSummary } from "../domain/chat/chat";
import { homeMachine } from "./home.machine";
import { testTransition } from "./machine.spec.utils";

const directChat: DirectChatSummary = {
    kind: "direct_chat",
    them: "abcdefg",
    chatId: "abcdefg",
    lastUpdated: BigInt(0),
    latestReadByMe: 0,
    latestReadByThem: 0,
    latestMessage: undefined,
    latestEventIndex: 0,
    dateCreated: BigInt(0),
};

const groupChat: GroupChatSummary = {
    kind: "group_chat",
    name: "my group chat",
    description: "some group or other",
    participants: [
        {
            role: "standard",
            userId: "123456",
        },
    ],
    public: true,
    joined: BigInt(+new Date()),
    minVisibleMessageIndex: 0,
    chatId: "123456",
    latestReadByMe: 0,
    latestMessage: undefined,
    latestEventIndex: 0,
    lastUpdated: BigInt(+new Date()),
};

describe("home machine transitions", () => {
    test("getUpdates fails", () => {
        testTransition(
            homeMachine,
            "loading_chats",
            "error.platform.getUpdates",
            "unexpected_error"
        );
    });
    test("getChats succeeds", () => {
        testTransition(
            homeMachine,
            "loading_chats",
            {
                type: "done.invoke.getUpdates",
                data: {
                    chatSummaries: [],
                    userLookup: {},
                    usersLastUpdate: BigInt(0),
                    directChatsLastUpdate: BigInt(0),
                },
            },
            { loaded_chats: "no_chat_selected" }
        );
    });
    test("trigger load messages", () => {
        const ctx = testTransition(
            homeMachine.withContext({
                chatSummaries: [directChat],
                userLookup: {},
                usersLastUpdate: BigInt(0),
                chatsIndex: {},
            }),
            { loaded_chats: "no_chat_selected" },
            { type: "SELECT_CHAT", data: { chatId: "abcdefg", messageIndex: undefined } },
            {
                loaded_chats: "chat_selected",
            }
        );
        expect(ctx.chatsIndex["abcdefg"]).not.toBe(undefined);
    });
    test("trigger load messages - does nothing for invalid chat", () => {
        const ctx = testTransition(
            homeMachine,
            { loaded_chats: "no_chat_selected" },
            { type: "SELECT_CHAT", data: { chatId: "qwxyz", messageIndex: undefined } },
            {
                loaded_chats: "no_chat_selected",
            }
        );
        expect(ctx.chatsIndex["qwxyz"]).toBe(undefined);
    });
    test("clear selected chat", () => {
        const ctx = testTransition(
            homeMachine.withContext({
                chatSummaries: [directChat],
                userLookup: {},
                usersLastUpdate: BigInt(0),
                selectedChat: directChat,
                chatsIndex: {},
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
                    usersLastUpdate: BigInt(100),
                },
            },
            {
                loaded_chats: "no_chat_selected",
            }
        );

        expect(ctx.usersLastUpdate).toBe(BigInt(100));
        expect(ctx.userLookup["123"].username).toBe("me");
    });

    test("new chat clicked", () => {
        testTransition(homeMachine, { loaded_chats: "no_chat_selected" }, "NEW_CHAT", {
            loaded_chats: "new_chat",
        });
    });

    test("new group received", () => {
        const ctx = testTransition(
            homeMachine,
            { loaded_chats: "new_group" },
            { type: "GROUP_CHAT_CREATED", data: groupChat },
            { loaded_chats: "new_group" }
        );
        expect(ctx.chatSummaries.length).toBe(1);
        expect(ctx.chatSummaries[0]).toMatchObject({
            chatId: "123456",
        });
    });

    test("cancel new chat", () => {
        testTransition(homeMachine, { loaded_chats: "new_chat" }, "CANCEL_NEW_CHAT", {
            loaded_chats: "no_chat_selected",
        });
    });

    test("join group clicked", () => {
        testTransition(homeMachine, { loaded_chats: "no_chat_selected" }, "JOIN_GROUP", {
            loaded_chats: "join_group",
        });
    });

    test("cancel join group", () => {
        testTransition(homeMachine, { loaded_chats: "join_group" }, "CANCEL_JOIN_GROUP", {
            loaded_chats: "no_chat_selected",
        });
    });

    test("chats updated - updates context", () => {
        const ctx = testTransition(
            homeMachine,
            { loaded_chats: "no_chat_selected" },
            {
                type: "CHATS_UPDATED",
                data: {
                    chatSummaries: [directChat],
                    directChatsLastUpdate: BigInt(200),
                    userLookup: {
                        "123": { userId: "123", username: "me", secondsSinceLastOnline: 10 },
                    },
                    usersLastUpdate: BigInt(100),
                },
            },
            {
                loaded_chats: "no_chat_selected",
            }
        );

        expect(ctx.usersLastUpdate).toBe(BigInt(100));
        expect(ctx.userLookup["123"].username).toBe("me");
        expect(ctx.chatSummaries[0]).toEqual(directChat);
        expect(ctx.directChatsLastUpdate).toBe(BigInt(200));
    });
});
