/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
    assign,
    createMachine,
    DoneInvokeEvent,
    MachineConfig,
    MachineOptions,
    sendParent,
} from "xstate";
import { inspect } from "@xstate/inspect";
import type { ServiceContainer } from "../services/serviceContainer";
import type { ChatSummary } from "../domain/chat";
import { userIdsFromChatSummaries } from "../domain/chat.utils";
import type { User, UserLookup, UsersResponse } from "../domain/user";
import { mergeUsers, missingUserIds } from "../domain/user.utils";
import { rollbar } from "../utils/logging";
import { log } from "xstate/lib/actions";

if (typeof window !== "undefined") {
    inspect({
        iframe: false,
    });
}

const ONE_MINUTE = 60 * 1000;
const CHAT_UPDATE_INTERVAL = ONE_MINUTE;
const USER_UPDATE_INTERVAL = ONE_MINUTE;

export interface HomeContext {
    serviceContainer?: ServiceContainer;
    user?: User; // currently signed in user
    chats: ChatSummary[]; // the list of chats
    selectedChat?: ChatSummary; // the selected chat
    error?: Error; // any error that might have occurred
    userLookup: UserLookup; // a lookup of user summaries
    chatsTimestamp: bigint;
    usersTimestamp: bigint;
}

type ChatsResponse = {
    chats: ChatSummary[];
    chatsTimestamp: bigint;
    userLookup: UserLookup;
    usersTimestamp: bigint;
};
type UserUpdateResponse = { userLookup: UserLookup; usersTimestamp: bigint };
type LoadMessagesResponse = { userLookup: UserLookup };

export type HomeEvents =
    | { type: "LOAD_MESSAGES"; data: bigint }
    | { type: "CLEAR_SELECTED_CHAT" }
    | { type: "CHATS_UPDATED"; data: ChatsResponse }
    | { type: "USERS_UPDATED"; data: UserUpdateResponse }
    | { type: "done.invoke.getChats"; data: ChatsResponse }
    | { type: "error.platform.getChats"; data: Error }
    | { type: "done.invoke.loadMessages"; data: LoadMessagesResponse }
    | { type: "error.platform.loadMessages"; data: Error };

async function getChats(
    serviceContainer: ServiceContainer,
    userLookup: UserLookup,
    since: bigint
): Promise<ChatsResponse> {
    // todo - for getting chats we also want to look up any (direct chat) users that we know nothing about
    // since these users are completely unknown we can just pass 0 for the user's timestamp in this scenario.
    // I *think* that's correct!
    try {
        const chatsResponse = await serviceContainer.getChats(since);
        const userIds = userIdsFromChatSummaries(chatsResponse.chats, false);
        const usersResponse = await serviceContainer.getUsers(
            missingUserIds(userLookup, userIds),
            BigInt(0)
        );

        return {
            chats: chatsResponse.chats,
            chatsTimestamp: chatsResponse.timestamp,
            userLookup: mergeUsers(userLookup, usersResponse.users),
            usersTimestamp: usersResponse.timestamp,
        };
    } catch (err) {
        rollbar.error("Error getting chats", err);
        throw err;
    }
}

const liveConfig: Partial<MachineOptions<HomeContext, HomeEvents>> = {
    guards: {
        selectedChatIsValid: (ctx, ev) => {
            if (ev.type === "LOAD_MESSAGES") {
                return ctx.chats.findIndex((c) => c.chatId === ev.data) >= 0;
            }
            return false;
        },
    },
    services: {
        getChats: async (ctx, _) =>
            getChats(ctx.serviceContainer!, ctx.userLookup, ctx.chatsTimestamp),

        updateChatsPoller: (ctx, _ev) => (callback) => {
            const id = setInterval(async () => {
                callback({
                    type: "CHATS_UPDATED",
                    data: await getChats(ctx.serviceContainer!, ctx.userLookup, ctx.chatsTimestamp),
                });
            }, CHAT_UPDATE_INTERVAL);
            return () => {
                clearInterval(id);
            };
        },

        updateUsersPoller: (ctx, _ev) => (callback) => {
            const id = setInterval(async () => {
                let usersResp: UsersResponse;
                try {
                    usersResp = await ctx.serviceContainer!.getUsers(
                        Object.keys(ctx.userLookup),
                        ctx.usersTimestamp
                    );
                    callback({
                        type: "USERS_UPDATED",
                        data: {
                            userLookup: mergeUsers(ctx.userLookup, usersResp.users),
                            usersTimestamp: usersResp.timestamp,
                        },
                    });
                } catch (err) {
                    // exceptions in a poller do not stop the poller, but we *do* want to know about it
                    rollbar.error("Error updating users", err);
                    throw err;
                }
            }, USER_UPDATE_INTERVAL);
            return () => {
                clearInterval(id);
            };
        },

        // todo - implementation required - this just does nothing at the moment
        loadMessages: async (ctx, _) => {
            if (ctx.selectedChat && ctx.selectedChat.kind === "group_chat") {
                console.log("looking up users for group chat");
                const userIds = userIdsFromChatSummaries([ctx.selectedChat], true);
                const { users } = await ctx.serviceContainer!.getUsers(
                    missingUserIds(ctx.userLookup, userIds),
                    BigInt(0) // timestamp irrelevant for missing users
                );
                // we might also load messages in here or we might use a spawned actor
                // tbd next
                return {
                    userLookup: mergeUsers(ctx.userLookup, users),
                };
            }
        },
    },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const schema: MachineConfig<HomeContext, any, HomeEvents> = {
    id: "logged_in_machine",
    initial: "loading_chats",
    context: {
        chats: [],
        userLookup: {},
        chatsTimestamp: BigInt(0),
        usersTimestamp: BigInt(0),
    },
    states: {
        loading_chats: {
            invoke: {
                id: "getChats",
                src: "getChats",
                onDone: {
                    target: "loaded_chats",
                    actions: assign((ctx, ev: DoneInvokeEvent<ChatsResponse>) => {
                        if (ev.type === "done.invoke.getChats") {
                            return {
                                ...ev.data,
                                error: undefined,
                            };
                        }
                        return ctx;
                    }),
                },
                onError: {
                    target: "unexpected_error",
                    actions: assign({
                        error: (_, { data }) => data,
                    }),
                },
            },
        },
        loaded_chats: {
            initial: "no_chat_selected",
            id: "loaded_chats",
            invoke: [
                {
                    id: "updateChatsPoller",
                    src: "updateChatsPoller",
                },
                {
                    id: "updateUsersPoller",
                    src: "updateUsersPoller",
                },
            ],
            on: {
                USERS_UPDATED: {
                    internal: true,
                    actions: assign((ctx, ev) => {
                        if (ev.type === "USERS_UPDATED") {
                            return ev.data;
                        }
                        return ctx;
                    }),
                },
                CHATS_UPDATED: {
                    internal: true,
                    actions: assign((ctx, ev) => {
                        if (ev.type === "CHATS_UPDATED") {
                            return ev.data;
                        }
                        return ctx;
                    }),
                },
                LOAD_MESSAGES: {
                    internal: true,
                    target: ".loading_messages",
                    cond: "selectedChatIsValid",
                },
                CLEAR_SELECTED_CHAT: {
                    internal: true,
                    target: ".no_chat_selected",
                    actions: assign({
                        selectedChat: (_ctx, _) => undefined,
                    }),
                },
            },
            states: {
                loading_messages: {
                    entry: assign({
                        selectedChat: (ctx, ev) => {
                            if (ev.type === "LOAD_MESSAGES") {
                                return ctx.chats.find((c) => c.chatId === ev.data);
                            }
                            return undefined;
                        },
                    }),
                    invoke: {
                        id: "loadMessages",
                        src: "loadMessages",
                        onDone: {
                            target: "chat_selected",
                            actions: assign((ctx, ev: DoneInvokeEvent<LoadMessagesResponse>) => {
                                console.log("assigning group chat users");
                                return ev.type === "done.invoke.loadGroupChatUsers" ? ev.data : ctx;
                            }),
                        },
                        onError: {
                            target: "unexpected_error",
                            actions: assign({
                                error: (_, { data }) => data,
                            }),
                        },
                    },
                },
                no_chat_selected: {},
                chat_selected: {
                    entry: log("entering the chat_selected state"),
                },
            },
        },
        unexpected_error: {
            type: "final",
            entry: sendParent((ctx, _) => ({
                type: "error.platform.homeMachine",
                data: ctx.error,
            })),
        },
    },
};

export const homeMachine = createMachine<HomeContext, HomeEvents>(schema, liveConfig);
export type HomeMachine = typeof homeMachine;
