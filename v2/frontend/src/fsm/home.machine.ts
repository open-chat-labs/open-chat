/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
    ActionObject,
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
import type {
    ChatSummary,
    DirectChatReplyContext,
    DirectChatSummary,
    EnhancedReplyContext,
    GroupChatSummary,
    ReplyContext,
} from "../domain/chat/chat";
import {
    setMessageRead,
    updateArgsFromChats,
    userIdsFromChatSummaries,
} from "../domain/chat/chat.utils";
import type { User, UserLookup, UsersResponse, UserSummary } from "../domain/user/user";
import { mergeUsers, missingUserIds } from "../domain/user/user.utils";
import { rollbar } from "../utils/logging";
import { log, pure, send } from "xstate/lib/actions";
import { chatMachine, ChatMachine } from "./chat.machine";
import { userSearchMachine } from "./userSearch.machine";
import { push } from "svelte-spa-router";
import { background } from "../stores/background";
import { groupMachine, nullGroup } from "./group.machine";
import { markReadMachine } from "./markread.machine";

const ONE_MINUTE = 60 * 1000;
const CHAT_UPDATE_INTERVAL = 5000;
const CHAT_UPDATE_IDLE_INTERVAL = ONE_MINUTE;
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
    chatUpdatesSince?: bigint; // first time through this will be undefined
    replyingTo?: EnhancedReplyContext<ReplyContext>;
    blockedUsers: Set<string>;
    unconfirmed: Set<bigint>;
}

export type HomeEvents =
    | { type: "SELECT_CHAT"; data: { chatId: string; messageIndex: string | undefined } }
    | { type: "NEW_CHAT" }
    | { type: "NEW_GROUP" }
    | { type: "JOIN_GROUP" }
    | { type: "CANCEL_JOIN_GROUP" }
    | { type: "CREATE_DIRECT_CHAT"; data: string }
    | { type: "UNCONFIRMED_MESSAGE"; data: bigint }
    | { type: "MESSAGE_CONFIRMED"; data: bigint }
    | { type: "BLOCK_USER"; data: string }
    | { type: "UNBLOCK_USER"; data: string }
    | { type: "CANCEL_NEW_CHAT" }
    | { type: "CLEAR_SELECTED_CHAT" }
    | { type: "REPLY_PRIVATELY_TO"; data: EnhancedReplyContext<DirectChatReplyContext> }
    | { type: "MESSAGE_READ_BY_ME"; data: { chatId: string; messageIndex: number } }
    | { type: "SYNC_WITH_POLLER"; data: HomeContext }
    | { type: "CHATS_UPDATED"; data: ChatsResponse }
    | { type: "LEAVE_GROUP"; data: string }
    | { type: "USERS_UPDATED"; data: UserUpdateResponse }
    | { type: "done.invoke.getUpdates"; data: ChatsResponse }
    | { type: "error.platform.getUpdates"; data: Error }
    | { type: "done.invoke.groupMachine"; data: GroupChatSummary }
    | { type: "error.platform.groupMachine"; data: Error }
    | { type: "done.invoke.userSearchMachine"; data: UserSummary }
    | { type: "error.platform.userSearchMachine"; data: Error };

type ChatsIndex = Record<string, ActorRefFrom<ChatMachine>>;

type ChatsResponse = {
    chatSummaries: ChatSummary[];
    chatUpdatesSince: bigint;
    userLookup: UserLookup;
    usersLastUpdate: bigint;
    blockedUsers: Set<string>;
};
type UserUpdateResponse = { userLookup: UserLookup; usersLastUpdate: bigint };

async function getUpdates(
    serviceContainer: ServiceContainer,
    userLookup: UserLookup,
    chatSummaries: ChatSummary[],
    chatUpdatesSince?: bigint
): Promise<ChatsResponse> {
    try {
        const chatsResponse = await serviceContainer.getUpdates(
            chatSummaries,
            chatUpdatesSince
                ? updateArgsFromChats(chatUpdatesSince, chatSummaries)
                : { updatesSince: undefined }
        );
        const userIds = userIdsFromChatSummaries(chatsResponse.chatSummaries, false);
        const usersResponse = await serviceContainer.getUsers(
            missingUserIds(userLookup, userIds),
            BigInt(0)
        );

        return {
            chatSummaries: chatsResponse.chatSummaries,
            chatUpdatesSince: chatsResponse.timestamp,
            userLookup: mergeUsers(userLookup, usersResponse.users),
            usersLastUpdate: usersResponse.timestamp,
            blockedUsers: chatsResponse.blockedUsers,
        };
    } catch (err) {
        rollbar.error("Error getting chats", err as Error);
        throw err;
    }
}

const liveConfig: Partial<MachineOptions<HomeContext, HomeEvents>> = {
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
                ctx.chatUpdatesSince
            ),

        updateChatsPoller: (ctx, _ev) => (callback, receive) => {
            let { userLookup, chatSummaries, chatUpdatesSince } = ctx;
            let intervalId: NodeJS.Timeout | undefined;

            const unsubBackground = background.subscribe((hidden) => {
                intervalId = poll(hidden ? CHAT_UPDATE_IDLE_INTERVAL : CHAT_UPDATE_INTERVAL);
            });

            receive((ev) => {
                // we need to capture the latest state of the parent machine whenever it changes
                // still feel a bit uneasy about this
                if (ev.type === "SYNC_WITH_POLLER") {
                    userLookup = ev.data.userLookup;
                    chatSummaries = ev.data.chatSummaries;
                    chatUpdatesSince = ev.data.chatUpdatesSince;
                }
            });

            function poll(interval: number): NodeJS.Timeout {
                intervalId && clearInterval(intervalId);
                return setInterval(async () => {
                    callback({
                        type: "CHATS_UPDATED",
                        data: await getUpdates(
                            ctx.serviceContainer!,
                            userLookup,
                            chatSummaries,
                            chatUpdatesSince
                        ),
                    });
                }, interval);
            }

            return () => {
                console.log("stopping the chats polller");
                intervalId && clearInterval(intervalId);
                unsubBackground();
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
                    rollbar.error("Error updating users", err as Error);
                    throw err;
                }
            }, USER_UPDATE_INTERVAL);
            return () => {
                console.log("stopping the user update polller");
                clearInterval(id);
            };
        },
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
        blockedUsers: new Set<string>(),
        unconfirmed: new Set<bigint>(),
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
                LEAVE_GROUP: {
                    internal: true,
                    actions: [
                        assign((ctx, ev) => ({
                            chatSummaries: ctx.chatSummaries.filter((c) => c.chatId !== ev.data),
                            selectedChat: undefined,
                        })),
                        send((ctx, _) => ({ type: "SYNC_WITH_POLLER", data: ctx }), {
                            to: "updateChatsPoller",
                        }),
                    ],
                },
                USERS_UPDATED: {
                    internal: true,
                    actions: assign((ctx, ev) => ev.data),
                },
                CHATS_UPDATED: {
                    internal: true,
                    actions: [
                        assign((_, ev) => ev.data),
                        send((ctx, _) => ({ type: "SYNC_WITH_POLLER", data: ctx }), {
                            to: "updateChatsPoller",
                        }),
                        pure((ctx, ev) => {
                            // ping any chat actors with the latest copy of the chat
                            return ev.data.chatSummaries.reduce<
                                ActionObject<HomeContext, HomeEvents>[]
                            >((sends, chat) => {
                                const actor = ctx.chatsIndex[chat.chatId];
                                if (actor) {
                                    sends.push(
                                        send(
                                            {
                                                type: "CHAT_UPDATED",
                                                data: chat,
                                            },
                                            { to: actor.id }
                                        )
                                    );
                                }
                                return sends;
                            }, []);
                        }),
                    ],
                },
                SELECT_CHAT: {
                    internal: true,
                    cond: "selectedChatIsValid",
                    target: ".chat_selected",
                    actions: assign((ctx, ev) => {
                        const key = ev.data.chatId;
                        const chatSummary = ctx.chatSummaries.find(
                            (c) => c.chatId === ev.data.chatId
                        );
                        if (chatSummary) {
                            return {
                                selectedChat: chatSummary,
                                replyingTo: undefined,
                                chatsIndex: {
                                    ...ctx.chatsIndex,
                                    [key]: spawn(
                                        chatMachine.withContext({
                                            serviceContainer: ctx.serviceContainer!,
                                            chatSummary: { ...chatSummary }, //clone
                                            userLookup: ctx.userLookup,
                                            user: ctx.user
                                                ? {
                                                      userId: ctx.user.userId,
                                                      username: ctx.user.username,
                                                      secondsSinceLastOnline: 0,
                                                  }
                                                : undefined,
                                            events: [],
                                            focusIndex: ev.data.messageIndex
                                                ? Number(ev.data.messageIndex)
                                                : undefined,
                                            replyingTo: ctx.replyingTo,
                                            markMessages: spawn(
                                                markReadMachine.withContext({
                                                    serviceContainer: ctx.serviceContainer!,
                                                    chatSummary,
                                                    ranges: [],
                                                })
                                            ),
                                        }),
                                        `chat-${key}`
                                    ),
                                },
                            };
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
                NEW_GROUP: {
                    internal: true,
                    target: ".new_group",
                    actions: log("received new group"),
                },
                JOIN_GROUP: {
                    internal: true,
                    target: ".join_group",
                },
                BLOCK_USER: {
                    actions: assign((ctx, ev) => {
                        return {
                            blockedUsers: ctx.blockedUsers.add(ev.data),
                        };
                    }),
                },
                UNBLOCK_USER: {
                    actions: assign((ctx, ev) => {
                        ctx.blockedUsers.delete(ev.data);
                        return {
                            blockedUsers: ctx.blockedUsers,
                        };
                    }),
                },
                MESSAGE_READ_BY_ME: {
                    // this is fairly horrific, but it seems to be what we have to do
                    // need to think about what this is a symptom of .....
                    // basically we have multiple copies of the same data that need to
                    // be synchronised and we need to get rid of that somehow.
                    actions: pure((ctx, ev) => {
                        const actor = ctx.chatsIndex[ev.data.chatId];
                        if (actor) {
                            let chat: ChatSummary | undefined = undefined;
                            const chatSummaries = ctx.chatSummaries.map((c) => {
                                if (c.chatId === ev.data.chatId) {
                                    chat = setMessageRead(c, ev.data.messageIndex);
                                    return chat;
                                }
                                return c;
                            });

                            const actions = [
                                // update the chat summaries
                                assign<HomeContext, HomeEvents>({
                                    chatSummaries,
                                }),
                                // ping the update back to the relavant chat machine
                                send(
                                    {
                                        type: "CHAT_UPDATED",
                                        data: chat,
                                    },
                                    { to: actor.id }
                                ),
                                // sync the update to the chat poller
                                send<HomeContext, HomeEvents>(
                                    (ctx, _) => ({ type: "SYNC_WITH_POLLER", data: ctx }),
                                    {
                                        to: "updateChatsPoller",
                                    }
                                ),
                            ];
                            return actions;
                        }
                        throw new Error(
                            "We received a message from an actor but we couldn't find the actor??"
                        );
                    }),
                },
                REPLY_PRIVATELY_TO: {
                    actions: assign((ctx, ev) => {
                        // let's see if we already have a direct chat with this user?
                        const chat = ctx.chatSummaries.find((c) => {
                            return c.kind === "direct_chat" && c.them === ev.data.sender?.userId;
                        });
                        if (chat) {
                            push(`/${chat.chatId}`);
                            return {
                                replyingTo: ev.data,
                            };
                        } else {
                            const newChat: DirectChatSummary = {
                                kind: "direct_chat",
                                them: ev.data.sender!.userId,
                                chatId: ev.data.sender!.userId,
                                readByMe: [],
                                readByThem: [],
                                latestMessage: undefined,
                                latestEventIndex: 0,
                                dateCreated: BigInt(+new Date()),
                            };
                            const chatSummaries: ChatSummary[] = [newChat, ...ctx.chatSummaries];
                            push(`/${newChat.chatId}`);
                            return {
                                replyingTo: ev.data,
                                chatSummaries,
                            };
                        }
                    }),
                },
                CREATE_DIRECT_CHAT: {
                    internal: true,
                    actions: [
                        assign((ctx, ev) => {
                            const dummyChat: DirectChatSummary = {
                                kind: "direct_chat",
                                them: ev.data,
                                chatId: ev.data,
                                readByMe: [],
                                readByThem: [],
                                latestMessage: undefined,
                                latestEventIndex: 0,
                                dateCreated: BigInt(+new Date()),
                            };
                            push(`/${dummyChat.chatId}`);
                            return {
                                chatSummaries: [dummyChat, ...ctx.chatSummaries],
                            };
                        }),
                        send((ctx, _) => ({ type: "SYNC_WITH_POLLER", data: ctx }), {
                            to: "updateChatsPoller",
                        }),
                    ],
                },
                UNCONFIRMED_MESSAGE: {
                    actions: assign((ctx, ev) => ({
                        unconfirmed: ctx.unconfirmed.add(ev.data),
                    })),
                },
                MESSAGE_CONFIRMED: {
                    actions: assign((ctx, ev) => {
                        ctx.unconfirmed.delete(ev.data);
                        return {
                            unconfirmed: ctx.unconfirmed,
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
                new_group: {
                    invoke: {
                        id: "groupMachine",
                        src: groupMachine,
                        data: (ctx, _) => {
                            return {
                                user: ctx.user,
                                serviceContainer: ctx.serviceContainer,
                                candidateGroup: nullGroup,
                                error: undefined,
                            };
                        },
                        onDone: { target: "no_chat_selected" },
                        onError: {
                            // todo - as in many other cases, this needs sorting out properly
                            internal: true,
                            target: "..unexpected_error",
                            actions: [
                                assign({
                                    error: (_, { data }) => data,
                                }),
                            ],
                        },
                    },
                },
                new_chat: {
                    entry: log("entering new chat"),
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
                            actions: [
                                assign((ctx, ev: DoneInvokeEvent<UserSummary>) => {
                                    const dummyChat: DirectChatSummary = {
                                        kind: "direct_chat",
                                        them: ev.data.userId,
                                        chatId: ev.data.userId,
                                        readByMe: [],
                                        readByThem: [],
                                        latestMessage: undefined,
                                        latestEventIndex: 0,
                                        dateCreated: BigInt(+new Date()),
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
                                send((ctx, _) => ({ type: "SYNC_WITH_POLLER", data: ctx }), {
                                    to: "updateChatsPoller",
                                }),
                            ],
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
