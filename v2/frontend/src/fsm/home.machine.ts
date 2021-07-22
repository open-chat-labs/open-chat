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
import { mergeChatUpdates, userIdsFromChatSummaries } from "../domain/chat/chat.utils";
import type { User, UserLookup, UsersResponse, UserSummary } from "../domain/user/user";
import { mergeUsers, missingUserIds } from "../domain/user/user.utils";
import { rollbar } from "../utils/logging";
import { log } from "xstate/lib/actions";
import { toastStore } from "../stores/toast";
import { chatMachine, ChatMachine } from "./chat.machine";
import { userSearchMachine } from "./userSearch.machine";
import { push } from "svelte-spa-router";

const ONE_MINUTE = 10 * 1000;
const CHAT_UPDATE_INTERVAL = ONE_MINUTE;
const USER_UPDATE_INTERVAL = ONE_MINUTE;

export interface HomeContext {
    serviceContainer?: ServiceContainer;
    user?: User; // currently signed in user
    chatSummaries: ChatSummary[]; // the list of chatSummaries
    selectedChat?: ChatSummary; // the selected chat
    error?: Error; // any error that might have occurred
    userLookup: UserLookup; // a lookup of user summaries
    usersLastUpdate: bigint;
    chatsIndex: ChatsIndex; //an index of all chat actors
    directChatsLastUpdate?: bigint;
}

export type HomeEvents =
    | { type: "SELECT_CHAT"; data: { chatId: string; messageIndex: string | undefined } }
    | { type: "NEW_CHAT" }
    | { type: "JOIN_GROUP" }
    | { type: "CANCEL_JOIN_GROUP" }
    | { type: "CREATE_DIRECT_CHAT"; data: string }
    | { type: "CANCEL_NEW_CHAT" }
    | { type: "CLEAR_SELECTED_CHAT" }
    | { type: "CHATS_UPDATED"; data: ChatsResponse }
    | { type: "LEAVE_GROUP"; data: string }
    | { type: "USERS_UPDATED"; data: UserUpdateResponse }
    | { type: "done.invoke.getUpdates"; data: ChatsResponse }
    | { type: "error.platform.getUpdates"; data: Error }
    | { type: "done.invoke.userSearchMachine"; data: UserSummary }
    | { type: "error.platform.userSearchMachine"; data: Error };

type ChatsIndex = Record<string, ActorRefFrom<ChatMachine>>;

type ChatsResponse = {
    chatSummaries: ChatSummary[];
    directChatsLastUpdate: bigint;
    userLookup: UserLookup;
    usersLastUpdate: bigint;
};
type UserUpdateResponse = { userLookup: UserLookup; usersLastUpdate: bigint };

async function getUpdates(
    serviceContainer: ServiceContainer,
    userLookup: UserLookup,
    chatSummaries: ChatSummary[],
    directChatsLastUpdate?: bigint
): Promise<ChatsResponse> {
    try {
        const chatsResponse = await serviceContainer.getUpdates({
            lastUpdated: directChatsLastUpdate,
            groups: chatSummaries
                .filter((c) => c.kind === "group_chat")
                .map((g) => ({ chatId: g.chatId, lastUpdated: g.lastUpdated })),
        });
        const userIds = userIdsFromChatSummaries(chatsResponse.chatsAdded, false);
        const usersResponse = await serviceContainer.getUsers(
            missingUserIds(userLookup, userIds),
            BigInt(0)
        );

        return {
            chatSummaries: mergeChatUpdates(chatSummaries, chatsResponse),
            directChatsLastUpdate: chatsResponse.timestamp,
            userLookup: mergeUsers(userLookup, usersResponse.users),
            usersLastUpdate: usersResponse.timestamp,
        };
    } catch (err) {
        rollbar.error("Error getting chats", err);
        throw err;
    }
}

const liveConfig: Partial<MachineOptions<HomeContext, HomeEvents>> = {
    actions: {
        notifyLeftGroup: (_, _ev) => toastStore.showSuccessToast("leftGroup"),
        failedToLeaveGroup: (_, _ev) => toastStore.showFailureToast("failedToLeaveGroup"),
    },
    guards: {
        selectedChatIsValid: (ctx, ev) => {
            if (ev.type === "SELECT_CHAT") {
                return ctx.chatSummaries.findIndex((c) => c.chatId === ev.data.chatId) >= 0;
            }
            return false;
        },
    },
    services: {
        getUpdates: async (ctx, _) =>
            getUpdates(
                ctx.serviceContainer!,
                ctx.userLookup,
                ctx.chatSummaries,
                ctx.directChatsLastUpdate
            ),

        updateChatsPoller: (ctx, _ev) => (callback) => {
            const id = setInterval(async () => {
                // todo - not sure it's safe to use ctx for everything here
                // might have to capture the timestamp
                callback({
                    type: "CHATS_UPDATED",
                    data: await getUpdates(
                        ctx.serviceContainer!,
                        ctx.userLookup,
                        ctx.chatSummaries,
                        ctx.directChatsLastUpdate
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
        usersLastUpdate: BigInt(0),
        chatsIndex: {},
    },
    states: {
        loading_chats: {
            invoke: {
                id: "getUpdates",
                src: "getUpdates",
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
                    actions: [
                        "notifyLeftGroup",
                        // "failedToLeaveGroup",
                        assign((ctx, ev) => {
                            return {
                                chatSummaries: ctx.chatSummaries.filter(
                                    (c) => c.chatId !== ev.data
                                ),
                                selectedChat: undefined,
                            };
                        }),
                    ],
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
                        const key = ev.data.chatId.toString();
                        const chatSummary = ctx.chatSummaries.find(
                            (c) => c.chatId === ev.data.chatId
                        );
                        const chatActor = ctx.chatsIndex[key];
                        if (chatSummary) {
                            if (!chatActor) {
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
                                                latestMessageIndex:
                                                    chatSummary.latestMessage?.messageIndex ?? 0,
                                                focusIndex: ev.data.messageIndex
                                                    ? Number(ev.data.messageIndex)
                                                    : undefined,
                                            }),
                                            `chat-${key}`
                                        ),
                                    },
                                };
                            } else {
                                // if we *have* got a chat actor already then we still need to tell it if
                                // we want to focus a particular message index
                                if (ev.data.messageIndex) {
                                    chatActor.send({
                                        type: "GO_TO_MESSAGE_INDEX",
                                        data: Number(ev.data.messageIndex),
                                    });
                                }
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
                JOIN_GROUP: {
                    internal: true,
                    target: ".join_group",
                },
                CREATE_DIRECT_CHAT: {
                    internal: true,
                    actions: assign((ctx, ev) => {
                        const dummyChat: DirectChatSummary = {
                            kind: "direct_chat",
                            them: ev.data,
                            chatId: String(ctx.chatSummaries.length + 1),
                            lastUpdated: BigInt(+new Date()),
                            latestReadByMe: 0,
                            latestReadByThem: 0,
                            latestMessage: undefined,
                        };
                        push(`/${dummyChat.chatId}`);
                        return {
                            chatSummaries: [dummyChat, ...ctx.chatSummaries],
                        };
                    }),
                },
            },
            states: {
                no_chat_selected: {},
                chat_selected: {
                    entry: log("entering the chat_selected state"),
                },
                join_group: {
                    entry: log("entering join group"),
                    on: {
                        CANCEL_JOIN_GROUP: "no_chat_selected",
                    },
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
                                    latestReadByMe: 0,
                                    latestReadByThem: 0,
                                    latestMessage: undefined,
                                };
                                push(`/${dummyChat.chatId}`);
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
