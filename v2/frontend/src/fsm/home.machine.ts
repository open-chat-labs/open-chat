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

if (typeof window !== "undefined") {
    inspect({
        iframe: false,
    });
}

function missingUserIds(userLookup: UserLookup, userIds: string[]): string[] {
    return userIds.filter((userId) => userLookup[userId] === undefined);
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
}

type ChatsResponse = { chats: ChatSummary[]; users: UserSummary[] };

export type HomeEvents =
    | { type: "LOAD_MESSAGES"; data: bigint }
    | { type: "CLEAR_SELECTED_CHAT" }
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
            const { chats } = await ctx.serviceContainer!.getChats();
            const userIds = userIdsFromChatSummaries(chats);
            const { users } = await ctx.serviceContainer!.getUsers(
                missingUserIds(ctx.userLookup, userIds)
            );
            return {
                chats,
                users,
            };
        },
        loadMessages: (_ctx, _) => new Promise((resolve) => setTimeout(resolve, 1000)),
    },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const schema: MachineConfig<HomeContext, any, HomeEvents> = {
    id: "logged_in_machine",
    initial: "loading_chats",
    context: {
        chats: [],
        userLookup: {},
    },
    states: {
        loading_chats: {
            invoke: {
                id: "getChats",
                src: "getChats",
                onDone: [
                    {
                        target: "loaded_chats",
                        actions: assign({
                            chats: (_, ev: DoneInvokeEvent<ChatsResponse>) => {
                                return ev.type === "done.invoke.getChats" ? ev.data.chats : [];
                            },
                            userLookup: (ctx, ev: DoneInvokeEvent<ChatsResponse>) => {
                                if (ev.type === "done.invoke.getChats") {
                                    return mergeUsers(ctx.userLookup, ev.data.users);
                                }
                                return ctx.userLookup;
                            },
                            error: (_, _ev) => undefined,
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
            on: {
                LOAD_MESSAGES: {
                    // if we arrive at this outer handler it means we are not currently loading chats
                    // so we can immediately go off and try to load the messages
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
