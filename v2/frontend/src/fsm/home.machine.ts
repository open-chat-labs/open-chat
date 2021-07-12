/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
    ActorRefFrom,
    assign,
    createMachine,
    DoneInvokeEvent,
    MachineConfig,
    MachineOptions,
    sendParent,
    spawn,
} from "xstate";
import type { ServiceContainer } from "../services/serviceContainer";
import type { ChatSummary } from "../domain/chat/chat";
import { userIdsFromChatSummaries } from "../domain/chat/chat.utils";
import type { User, UserLookup, UsersResponse } from "../domain/user/user";
import { mergeUsers, missingUserIds } from "../domain/user/user.utils";
import { rollbar } from "../utils/logging";
import { log } from "xstate/lib/actions";
import { chatMachine, ChatMachine } from "./chat.machine";

const ONE_MINUTE = 60 * 1000;
const CHAT_UPDATE_INTERVAL = ONE_MINUTE;
const USER_UPDATE_INTERVAL = ONE_MINUTE;

export interface HomeContext {
    serviceContainer?: ServiceContainer;
    user?: User; // currently signed in user
    chatSummaries: ChatSummary[]; // the list of chatSummaries
    selectedChat?: ChatSummary; // the selected chat
    error?: Error; // any error that might have occurred
    userLookup: UserLookup; // a lookup of user summaries
    chatSummariesLastUpdate: bigint;
    usersLastUpdate: bigint;
    chatsIndex: ChatsIndex; //an index of all chat actors
}

export type HomeEvents =
    | { type: "SELECT_CHAT"; data: bigint }
    | { type: "CLEAR_SELECTED_CHAT" }
    | { type: "CHATS_UPDATED"; data: ChatsResponse }
    | { type: "LEAVE_GROUP"; data: bigint }
    | { type: "USERS_UPDATED"; data: UserUpdateResponse }
    | { type: "done.invoke.getChats"; data: ChatsResponse }
    | { type: "error.platform.getChats"; data: Error };

type ChatsIndex = Record<string, ActorRefFrom<ChatMachine>>;

type ChatsResponse = {
    chatSummaries: ChatSummary[];
    chatSummariesLastUpdate: bigint;
    userLookup: UserLookup;
    usersLastUpdate: bigint;
};
type UserUpdateResponse = { userLookup: UserLookup; usersLastUpdate: bigint };

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
            chatSummaries: chatsResponse.chats,
            chatSummariesLastUpdate: chatsResponse.timestamp,
            userLookup: mergeUsers(userLookup, usersResponse.users),
            usersLastUpdate: usersResponse.timestamp,
        };
    } catch (err) {
        rollbar.error("Error getting chats", err);
        throw err;
    }
}

const liveConfig: Partial<MachineOptions<HomeContext, HomeEvents>> = {
    guards: {
        selectedChatIsValid: (ctx, ev) => {
            if (ev.type === "SELECT_CHAT") {
                return ctx.chatSummaries.findIndex((c) => c.chatId === ev.data) >= 0;
            }
            return false;
        },
    },
    services: {
        getChats: async (ctx, _) =>
            getChats(ctx.serviceContainer!, ctx.userLookup, ctx.chatSummariesLastUpdate),

        updateChatsPoller: (ctx, _ev) => (callback) => {
            const id = setInterval(async () => {
                console.log("checking for updated chats");
                callback({
                    type: "CHATS_UPDATED",
                    data: await getChats(
                        ctx.serviceContainer!,
                        ctx.userLookup,
                        ctx.chatSummariesLastUpdate
                    ),
                });
            }, CHAT_UPDATE_INTERVAL);
            return () => {
                console.log("stopping the chats polller");
                clearInterval(id);
            };
        },

        updateUsersPoller: (ctx, _ev) => (callback) => {
            const id = setInterval(async () => {
                console.log("checking for updated users");
                let usersResp: UsersResponse;
                try {
                    usersResp = await ctx.serviceContainer!.getUsers(
                        Object.keys(ctx.userLookup),
                        ctx.usersLastUpdate
                    );
                    callback({
                        type: "USERS_UPDATED",
                        data: {
                            userLookup: mergeUsers(ctx.userLookup, usersResp.users),
                            usersLastUpdate: usersResp.timestamp,
                        },
                    });
                } catch (err) {
                    // exceptions in a poller do not stop the poller, but we *do* want to know about it
                    rollbar.error("Error updating users", err);
                    throw err;
                }
            }, USER_UPDATE_INTERVAL);
            return () => {
                console.log("stopping the user update polller");
                clearInterval(id);
            };
        },

        // todo - implementation required - this just does nothing at the moment
    },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const schema: MachineConfig<HomeContext, any, HomeEvents> = {
    id: "home_machine",
    initial: "loading_chats",
    context: {
        chatSummaries: [],
        userLookup: {},
        chatSummariesLastUpdate: BigInt(0),
        usersLastUpdate: BigInt(0),
        chatsIndex: {},
    },
    states: {
        loading_chats: {
            invoke: {
                id: "getChats",
                src: "getChats",
                onDone: {
                    target: "loaded_chats",
                    actions: assign((ctx, ev: DoneInvokeEvent<ChatsResponse>) => {
                        return {
                            ...ev.data,
                            error: undefined,
                        };
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
                // todo - obviously we need to invoke some api call here as well ...
                LEAVE_GROUP: {
                    internal: true,
                    actions: assign((ctx, ev) => {
                        return {
                            chatSummaries: ctx.chatSummaries.filter((c) => c.chatId !== ev.data),
                            selectedChat: undefined,
                        };
                    }),
                },
                USERS_UPDATED: {
                    internal: true,
                    actions: assign((ctx, ev) => ev.data),
                },
                CHATS_UPDATED: {
                    internal: true,
                    actions: assign((_, ev) => ev.data),
                },
                SELECT_CHAT: {
                    internal: true,
                    cond: "selectedChatIsValid",
                    target: ".chat_selected",
                    actions: assign((ctx, ev) => {
                        const key = ev.data.toString();
                        const chatSummary = ctx.chatSummaries.find((c) => c.chatId === ev.data);
                        if (!ctx.chatsIndex[key]) {
                            if (chatSummary) {
                                // todo - is there actually any benefit to mantaining a dictionary of
                                // chat actors? It allows us to preserve state within each actor but are
                                // we actually going to do that?
                                // An alternative would be to just have one selected chat machine that is
                                // stateless i.e. it loads its messages each time it is activated. That
                                // doesn't mean that those messages can't still be cached - they would
                                // just not be cached in the actor's memory.
                                return {
                                    selectedChat: chatSummary,
                                    chatsIndex: {
                                        ...ctx.chatsIndex,
                                        [key]: spawn(
                                            chatMachine.withContext({
                                                serviceContainer: ctx.serviceContainer!,
                                                chatSummary,
                                                userLookup: ctx.userLookup,
                                                user: ctx.user
                                                    ? {
                                                          userId: ctx.user.userId,
                                                          username: ctx.user.username,
                                                          secondsSinceLastOnline: 0,
                                                      }
                                                    : undefined,
                                            }),
                                            `chat-${key}`
                                        ),
                                    },
                                };
                            }
                        }
                        return { selectedChat: chatSummary };
                    }),
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
