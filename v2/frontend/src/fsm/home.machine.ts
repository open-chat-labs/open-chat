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
import { ChatSummary, userIdsFromChatSummaries } from "../domain/chat";
import type { User, UserLookup, UserSummary } from "../domain/user";
import { log } from "xstate/lib/actions";

if (typeof window !== "undefined") {
    inspect({
        iframe: false,
    });
}

// const CHAT_UPDATE_INTERVAL = 60 * 1000;
const CHAT_UPDATE_INTERVAL = 1000;

function missingUserIds(userLookup: UserLookup, userIds: Set<string>): string[] {
    return Array.from(userIds).filter((userId) => userLookup[userId] === undefined);
}

function mergeUsers(userLookup: UserLookup, users: UserSummary[]): UserLookup {
    return users.reduce<UserLookup>((lookup, user) => {
        lookup[user.userId] = user;
        return lookup;
    }, userLookup);
}

export interface HomeContext {
    serviceContainer?: ServiceContainer;
    user?: User; // currently signed in user
    chats: ChatSummary[]; // the list of chats
    selectedChat?: ChatSummary; // the selected chat
    error?: Error; // any error that might have occurred
    userLookup: UserLookup; // a lookup of user summaries
    chatsTimestamp: bigint;
}

type ChatsResponse = { chats: ChatSummary[]; users: UserSummary[]; timestamp: bigint };

export type HomeEvents =
    | { type: "LOAD_MESSAGES"; data: bigint }
    | { type: "CLEAR_SELECTED_CHAT" }
    | { type: "CHATS_UPDATED"; data: ChatsResponse }
    | { type: "done.invoke.getChats"; data: ChatsResponse }
    | { type: "error.platform.getChats"; data: Error };

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
        getChats: async (ctx, _) => {
            const { chats, timestamp } = await ctx.serviceContainer!.getChats(ctx.chatsTimestamp);
            const userIds = userIdsFromChatSummaries(chats, false);
            const { users } = await ctx.serviceContainer!.getUsers(
                missingUserIds(ctx.userLookup, userIds)
            );
            return {
                chats,
                timestamp,
                users,
            };
        },
        // todo - updateChats is virtually identical to the getChats.
        // We can probably do something about that but I'm not too worried about it at the moment
        updateChats: (ctx, _ev) => (callback) => {
            const id = setInterval(async () => {
                // todo - we need to handle any errors that may occur during polling
                const { chats, timestamp } = await ctx.serviceContainer!.getChats(
                    ctx.chatsTimestamp
                );
                const userIds = userIdsFromChatSummaries(chats, false);
                const { users } = await ctx.serviceContainer!.getUsers(
                    missingUserIds(ctx.userLookup, userIds)
                );
                callback({
                    type: "CHATS_UPDATED",
                    data: {
                        chats,
                        timestamp,
                        users,
                    },
                });
            }, CHAT_UPDATE_INTERVAL);
            return () => {
                console.log("Stopping update chats poller");
                clearInterval(id);
            };
        },

        // we need to run this periodically to make sure that our users are up to date
        updateUsers: async (ctx, _) => ctx.serviceContainer!.getUsers(Object.keys(ctx.userLookup)),

        // we will kick this off in parallel when we load a group chat
        loadMissingUsers: async (ctx, _) => {
            if (ctx.selectedChat && ctx.selectedChat.kind === "group_chat") {
                const userIds = userIdsFromChatSummaries([ctx.selectedChat], true);
                const { users } = await ctx.serviceContainer!.getUsers(
                    missingUserIds(ctx.userLookup, userIds)
                );
                return users;
            }
            return [];
        },
        loadMessages: (_ctx, _) => {
            return new Promise((resolve) => setTimeout(resolve, 1000));
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
    },
    states: {
        loading_chats: {
            invoke: {
                id: "getChats",
                src: "getChats",
                onDone: [
                    {
                        target: "loaded_chats",
                        actions: assign((ctx, ev: DoneInvokeEvent<ChatsResponse>) => {
                            if (ev.type === "done.invoke.getChats") {
                                return {
                                    chats: ev.data.chats,
                                    chatsTimestamp: ev.data.timestamp,
                                    userLookup: mergeUsers(ctx.userLookup, ev.data.users),
                                    error: undefined,
                                };
                            }
                            return ctx;
                        }),
                    },
                ],
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
            invoke: {
                id: "updateChats",
                src: "updateChats",
            },
            on: {
                CHATS_UPDATED: {
                    actions: assign((ctx, ev) => {
                        // todo - this assign is actually a bit more complicated since we need to splice the
                        // new chats with the existing chats
                        if (ev.type === "CHATS_UPDATED") {
                            return {
                                chats: ev.data.chats,
                                chatsTimestamp: ev.data.timestamp,
                                userLookup: mergeUsers(ctx.userLookup, ev.data.users),
                                error: undefined,
                            };
                        }
                        return ctx;
                    }),
                },
                LOAD_MESSAGES: {
                    target: "loaded_chats.loading_messages",
                    cond: "selectedChatIsValid",
                },
                CLEAR_SELECTED_CHAT: {
                    target: "loaded_chats.no_chat_selected",
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
                        onDone: [
                            {
                                target: "chat_selected",
                            },
                        ],
                    },
                },
                no_chat_selected: {},
                chat_selected: {},
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
