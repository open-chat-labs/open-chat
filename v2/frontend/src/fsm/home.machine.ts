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
import type { ChatSummary, DirectChatSummary } from "../domain/chat/chat";
import { userIdsFromChatSummaries } from "../domain/chat/chat.utils";
import type { User, UserLookup, UsersResponse, UserSummary } from "../domain/user/user";
import { mergeUsers, missingUserIds } from "../domain/user/user.utils";
import { rollbar } from "../utils/logging";
import { log } from "xstate/lib/actions";
import { chatMachine, ChatMachine } from "./chat.machine";
import { userSearchMachine } from "./userSearch.machine";
// import { push } from "svelte-spa-router";

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
    | { type: "SELECT_CHAT"; data: string }
    | { type: "NEW_CHAT" }
    | { type: "CANCEL_NEW_CHAT" }
    | { type: "CLEAR_SELECTED_CHAT" }
    | { type: "CHATS_UPDATED"; data: ChatsResponse }
    | { type: "LEAVE_GROUP"; data: string }
    | { type: "USERS_UPDATED"; data: UserUpdateResponse }
    | { type: "done.invoke.getChats"; data: ChatsResponse }
    | { type: "error.platform.getChats"; data: Error }
    | { type: "done.invoke.userSearchMachine"; data: UserSummary }
    | { type: "error.platform.userSearchMachine"; data: Error };

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
                let usersResp: UsersResponse;
                try {
                    usersResp = await ctx.serviceContainer!.getUsers(
                        Object.keys(ctx.userLookup),
                        ctx.usersLastUpdate
                    );
                    console.log("sending updated users");
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
            entry: log("entering loaded_chats"),
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
                    actions: assign((ctx, ev) => {
                        const selectedChat = ev.data.chatSummaries.find(
                            (c) => c.chatId === ctx.selectedChat?.chatId
                        );
                        return {
                            ...ev.data,
                            selectedChat,
                        };
                    }),
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

                                // todo - when chats are updated, the details of the selected chat may
                                // have changed. Currently if that chat is selected, the chat actor will have
                                // stale data and may show the wrong thing. We need to send an update message to the
                                // selected chat actor in that case to keep things in sync
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
                                                messages: [],
                                                latestMessageIndex: chatSummary.latestMessageIndex,
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
                NEW_CHAT: {
                    internal: true,
                    target: ".new_chat",
                    actions: log("received new chat"),
                },
            },
            states: {
                no_chat_selected: {},
                chat_selected: {
                    entry: log("entering the chat_selected state"),
                },
                new_chat: {
                    entry: log("entering new chat"),
                    exit: assign((_, ev) => {
                        console.log("exiting new chat: ", ev);
                        return {};
                    }),
                    on: {
                        // todo - actually we would like to go back to where we were
                        CANCEL_NEW_CHAT: "no_chat_selected",
                        "error.platform.userSearchMachine": "..unexpected_error",
                    },
                    invoke: {
                        id: "userSearchMachine",
                        src: userSearchMachine,
                        data: (ctx, _) => {
                            return {
                                serviceContainer: ctx.serviceContainer,
                                searchTerm: "",
                                users: [],
                                error: undefined,
                            };
                        },
                        onDone: {
                            target: "chat_selected",
                            actions: assign((ctx, ev: DoneInvokeEvent<UserSummary>) => {
                                const dummyChat: DirectChatSummary = {
                                    kind: "direct_chat",
                                    them: ev.data.userId,
                                    chatId: String(ctx.chatSummaries.length + 1),
                                    lastUpdated: BigInt(+new Date()),
                                    displayDate: BigInt(+new Date()),
                                    lastReadByUs: 0,
                                    lastReadByThem: 0,
                                    latestMessageIndex: 0,
                                    latestMessage: undefined,
                                };
                                // todo - if we want to select this chat, we actually want to
                                // push its id into the route
                                // todo - got to come back to this as it makes jest blow up
                                // push(`/${dummyChat.chatId}`);
                                return {
                                    chatSummaries: [dummyChat, ...ctx.chatSummaries],
                                    userLookup: {
                                        ...ctx.userLookup,
                                        [ev.data.userId]: ev.data,
                                    },
                                };
                            }),
                        },
                        onError: {
                            internal: true,
                            target: "..unexpected_error",
                            actions: [
                                log("an error occurred"),
                                assign({
                                    error: (_, { data }) => data,
                                }),
                            ],
                        },
                    },
                },
            },
        },
        unexpected_error: {
            type: "final",
            // todo - perhaps we should be using "escalate" here
            entry: sendParent((ctx, _) => ({
                type: "error.platform.homeMachine",
                data: ctx.error,
            })),
        },
    },
};

export const homeMachine = createMachine<HomeContext, HomeEvents>(schema, liveConfig);
export type HomeMachine = typeof homeMachine;
