/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { DirectChatSummary } from "../domain/chat/chat";
import type { ServiceContainer } from "../services/serviceContainer";
import { fakeMessageReadTracker } from "../stores/markRead";
import { HomeContext, homeMachine } from "./home.machine";
import { testTransition } from "./machine.spec.utils";

const directChat: DirectChatSummary = {
    kind: "direct_chat",
    them: "abcdefg",
    chatId: "abcdefg",
    readByMe: [],
    readByThem: [],
    latestMessage: undefined,
    latestEventIndex: 0,
    dateCreated: BigInt(0),
    notificationsMuted: false,
};

const homeContext: HomeContext = {
    serviceContainer: {} as ServiceContainer,
    user: {
        userId: "abcdef",
        username: "julian_jelfs",
    },
    chatSummaries: [],
    selectedChat: undefined,
    error: undefined,
    usersLastUpdate: BigInt(0),
    chatsIndex: {},
    chatUpdatesSince: undefined,
    replyingTo: undefined,
    markRead: fakeMessageReadTracker,
};

describe("home machine transitions", () => {
    test("getUpdates fails", () => {
        testTransition(
            homeMachine.withContext(homeContext),
            "loading_chats",
            "error.platform.getUpdates",
            "unexpected_error"
        );
    });
    test("getChats succeeds", () => {
        testTransition(
            homeMachine.withContext(homeContext),
            "loading_chats",
            {
                type: "done.invoke.getUpdates",
                data: {
                    chatSummaries: [],
                    usersLastUpdate: BigInt(0),
                    chatUpdatesSince: BigInt(0),
                    blockedUsers: new Set<string>(),
                },
            },
            { loaded_chats: "no_chat_selected" }
        );
    });
    test("trigger load messages", () => {
        const ctx = testTransition(
            homeMachine.withContext({
                chatSummaries: [directChat],
                usersLastUpdate: BigInt(0),
                chatsIndex: {},
                markRead: fakeMessageReadTracker,
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
            homeMachine.withContext(homeContext),
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
                usersLastUpdate: BigInt(0),
                selectedChat: directChat,
                chatsIndex: {},
                markRead: fakeMessageReadTracker,
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
            homeMachine.withContext(homeContext),
            { loaded_chats: "no_chat_selected" },
            {
                type: "USERS_UPDATED",
                data: {
                    usersLastUpdate: BigInt(100),
                },
            },
            {
                loaded_chats: "no_chat_selected",
            }
        );

        expect(ctx.usersLastUpdate).toBe(BigInt(100));
    });

    test("new chat clicked", () => {
        testTransition(
            homeMachine.withContext(homeContext),
            { loaded_chats: "no_chat_selected" },
            "NEW_CHAT",
            {
                loaded_chats: "new_chat",
            }
        );
    });

    test("cancel new chat", () => {
        testTransition(
            homeMachine.withContext(homeContext),
            { loaded_chats: "new_chat" },
            "CANCEL_NEW_CHAT",
            {
                loaded_chats: "no_chat_selected",
            }
        );
    });

    test("chats updated - updates context", () => {
        const ctx = testTransition(
            homeMachine.withContext(homeContext),
            { loaded_chats: "no_chat_selected" },
            {
                type: "CHATS_UPDATED",
                data: {
                    chatSummaries: [directChat],
                    chatUpdatesSince: BigInt(200),
                    usersLastUpdate: BigInt(100),
                    blockedUsers: new Set<string>(),
                },
            },
            {
                loaded_chats: "no_chat_selected",
            }
        );

        expect(ctx.usersLastUpdate).toBe(BigInt(100));
        expect(ctx.chatSummaries[0]).toEqual(directChat);
        expect(ctx.chatUpdatesSince).toBe(BigInt(200));
    });
});
