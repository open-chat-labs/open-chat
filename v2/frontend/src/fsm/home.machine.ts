/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
    assign,
    createMachine,
    DoneInvokeEvent,
    MachineConfig,
    MachineOptions,
    sendParent,
} from "xstate";
import type { ServiceContainer } from "../services/serviceContainer";
import type { ChatSummary, DirectChatSummary, EnhancedReplyContext } from "../domain/chat/chat";
import { updateArgsFromChats } from "../domain/chat/chat.utils";
import type { User, UsersResponse, UserSummary } from "../domain/user/user";
import { missingUserIds } from "../domain/user/user.utils";
import { rollbar } from "../utils/logging";
import { log, pure, send } from "xstate/lib/actions";
import { push } from "svelte-spa-router";
import { background } from "../stores/background";
import type { DataContent } from "../domain/data/data";
import { rtcConnectionsManager } from "../domain/webrtc/RtcConnectionsManager";
import { unconfirmed, unconfirmedReadByThem } from "../stores/unconfirmed";
import { get } from "svelte/store";
import type {
    RemoteUserDeletedMessage,
    RemoteUserReadMessage,
    RemoteUserRemovedMessage,
    RemoteUserSentMessage,
    RemoteUserToggledReaction,
    RemoteUserUndeletedMessage,
    WebRtcMessage,
} from "../domain/webrtc/webrtc";
import { typing } from "../stores/typing";
import type { IMessageReadTracker } from "../stores/markRead";
import { userStore } from "../stores/user";
import { closeNotificationsForChat } from "../utils/notifications";
import { blockedUsers } from "../stores/blockedUsers";
import { ChatController } from "./chat.controller";

const ONE_MINUTE = 60 * 1000;
const CHAT_UPDATE_INTERVAL = 5000;
const CHAT_UPDATE_IDLE_INTERVAL = ONE_MINUTE;
const USER_UPDATE_INTERVAL = ONE_MINUTE;

export interface HomeContext {
    serviceContainer?: ServiceContainer;
    user?: User; // currently signed in user
    chatSummaries: ChatSummary[]; // the list of chatSummaries
    error?: Error; // any error that might have occurred
    usersLastUpdate: bigint;
    selectedChat?: ChatController;
    chatUpdatesSince?: bigint; // first time through this will be undefined
    replyingTo?: EnhancedReplyContext;
    markRead: IMessageReadTracker;
}

export type HomeEvents =
    | { type: "SELECT_CHAT"; data: { chatId: string; messageIndex: string | undefined } }
    | { type: "NEW_CHAT" }
    | {
          type: "REMOTE_USER_TOGGLED_REACTION";
          data: RemoteUserToggledReaction;
      }
    | {
          type: "REMOTE_USER_DELETED_MESSAGE";
          data: RemoteUserDeletedMessage;
      }
    | {
          type: "REMOTE_USER_REMOVED_MESSAGE";
          data: RemoteUserRemovedMessage;
      }
    | {
          type: "REMOTE_USER_UNDELETED_MESSAGE";
          data: RemoteUserUndeletedMessage;
      }
    | {
          type: "REMOTE_USER_SENT_MESSAGE";
          data: RemoteUserSentMessage;
      }
    | {
          type: "REMOTE_USER_READ_MESSAGE";
          data: RemoteUserReadMessage;
      }
    | { type: "CREATE_DIRECT_CHAT"; data: string }
    | { type: "GO_TO_MESSAGE_INDEX"; data: number }
    | { type: "CANCEL_NEW_CHAT" }
    | { type: "CREATE_CHAT_WITH_USER"; data: UserSummary }
    | { type: "CLEAR_SELECTED_CHAT" }
    | { type: "UPDATE_USER_AVATAR"; data: DataContent }
    | { type: "REPLY_PRIVATELY_TO"; data: EnhancedReplyContext }
    | {
          type: "MESSAGE_READ_BY_ME";
          data: { chatId: string; messageIndex: number; messageId: bigint };
      }
    | { type: "SYNC_WITH_POLLER"; data: HomeContext }
    | { type: "SYNC_WITH_RTC_HANDLER"; data: HomeContext }
    | { type: "CHATS_UPDATED"; data: ChatsResponse }
    | { type: "LEAVE_GROUP"; data: string }
    | { type: "USERS_UPDATED"; data: UserUpdateResponse }
    | { type: "done.invoke.getUpdates"; data: ChatsResponse }
    | { type: "error.platform.getUpdates"; data: Error };

type ChatsResponse = {
    chatSummaries: ChatSummary[];
    chatUpdatesSince: bigint;
    usersLastUpdate: bigint;
    blockedUsers: Set<string>;
};
type UserUpdateResponse = { usersLastUpdate: bigint };

function findDirectChatByUserId(
    chats: ChatSummary[],
    userId: string
): DirectChatSummary | undefined {
    return chats.find((c) => c.kind === "direct_chat" && c.them === userId) as
        | DirectChatSummary
        | undefined;
}

function findChatById(chats: ChatSummary[], chatId: string): ChatSummary | undefined {
    return chats.find((c) => c.chatId === chatId);
}

function findChatByChatType(chats: ChatSummary[], msg: WebRtcMessage): ChatSummary | undefined {
    return msg.chatType === "group_chat"
        ? findChatById(chats, msg.chatId)
        : findDirectChatByUserId(chats, msg.userId);
}

function sendMessageToChatBasedOnUser(
    ctx: HomeContext,
    msg: WebRtcMessage,
    fn: (selectedChat: ChatController) => void
): void {
    const chat = findChatByChatType(ctx.chatSummaries, msg);
    if (chat === undefined) return;
    if (ctx.selectedChat === undefined) return;
    if (chat.chatId !== ctx.selectedChat.chatId) return;
    fn(ctx.selectedChat);
}

function userIdsFromDirectChatSummaries(chats: ChatSummary[]): Set<string> {
    const userIds = new Set<string>();
    chats.forEach((chat) => {
        if (chat.kind === "direct_chat") {
            userIds.add(chat.them);
        }
    });
    return userIds;
}

async function getUpdates(
    user: User,
    serviceContainer: ServiceContainer,
    messagesRead: IMessageReadTracker,
    chatSummaries: ChatSummary[],
    chatUpdatesSince?: bigint
): Promise<ChatsResponse> {
    try {
        const chatsResponse = chatUpdatesSince
            ? await serviceContainer.getUpdates(
                  chatSummaries,
                  updateArgsFromChats(chatUpdatesSince, chatSummaries),
                  messagesRead
              )
            : await serviceContainer.getInitialState(messagesRead);
        const userIds = userIdsFromDirectChatSummaries(chatsResponse.chatSummaries);
        userIds.add(user.userId);
        const usersResponse = await serviceContainer.getUsers(
            missingUserIds(get(userStore), userIds),
            BigInt(0)
        );

        userStore.addMany(usersResponse.users);
        blockedUsers.set(chatsResponse.blockedUsers);
        return {
            chatSummaries: chatsResponse.chatSummaries,
            chatUpdatesSince: chatsResponse.timestamp,
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
                ctx.user!,
                ctx.serviceContainer!,
                ctx.markRead,
                ctx.chatSummaries,
                ctx.chatUpdatesSince
            ),

        webRtcMessageHandler: (ctx, _ev) => (callback, receive) => {
            let selectedChat = ctx.selectedChat;
            let chatSummaries = ctx.chatSummaries;

            receive((ev) => {
                if (ev.type === "SYNC_WITH_RTC_HANDLER") {
                    console.log("updating local selectedChat");
                    selectedChat = ev.data.selectedChat;
                    chatSummaries = ev.data.chatSummaries;
                }
            });

            rtcConnectionsManager.subscribe((message: unknown) => {
                const parsedMsg = message as WebRtcMessage;

                const fromChat = findChatByChatType(chatSummaries, parsedMsg);

                // if the chat can't be found - ignore
                if (fromChat === undefined) {
                    return;
                }

                // if the message relates to a chat we don't have open - ignore
                if (fromChat.chatId !== selectedChat?.chatId) {
                    return;
                }

                // if the message is from a direct chat where the other user is blocked - ignore
                if (
                    selectedChat?.isDirectChatWith(parsedMsg.userId) &&
                    selectedChat?.isBlockedUser()
                ) {
                    return;
                }

                if (parsedMsg.kind === "remote_user_typing") {
                    typing.add(fromChat.chatId, parsedMsg.userId);
                }
                if (parsedMsg.kind === "remote_user_stopped_typing") {
                    typing.delete(fromChat.chatId, parsedMsg.userId);
                }
                if (parsedMsg.kind === "remote_user_toggled_reaction") {
                    callback({
                        type: "REMOTE_USER_TOGGLED_REACTION",
                        data: {
                            ...parsedMsg,
                            messageId: BigInt(parsedMsg.messageId),
                        },
                    });
                }
                if (parsedMsg.kind === "remote_user_deleted_message") {
                    callback({
                        type: "REMOTE_USER_DELETED_MESSAGE",
                        data: {
                            ...parsedMsg,
                            messageId: BigInt(parsedMsg.messageId),
                        },
                    });
                }
                if (parsedMsg.kind === "remote_user_removed_message") {
                    callback({
                        type: "REMOTE_USER_REMOVED_MESSAGE",
                        data: {
                            ...parsedMsg,
                            messageId: BigInt(parsedMsg.messageId),
                        },
                    });
                }
                if (parsedMsg.kind === "remote_user_undeleted_message") {
                    callback({
                        type: "REMOTE_USER_UNDELETED_MESSAGE",
                        data: parsedMsg,
                    });
                }
                if (parsedMsg.kind === "remote_user_sent_message") {
                    callback({
                        type: "REMOTE_USER_SENT_MESSAGE",
                        data: {
                            ...parsedMsg,
                            messageEvent: {
                                ...parsedMsg.messageEvent,
                                event: {
                                    ...parsedMsg.messageEvent.event,
                                    messageId: BigInt(parsedMsg.messageEvent.event.messageId),
                                },
                                timestamp: BigInt(parsedMsg.messageEvent.timestamp),
                            },
                        },
                    });
                }
                if (parsedMsg.kind === "remote_user_read_message") {
                    callback({
                        type: "REMOTE_USER_READ_MESSAGE",
                        data: {
                            ...parsedMsg,
                            messageId: BigInt(parsedMsg.messageId),
                        },
                    });
                }
            });
            return () => {
                rtcConnectionsManager.unsubscribe();
                console.log("stopping the webrtc message handler");
            };
        },

        updateChatsPoller: (ctx, _ev) => (callback, receive) => {
            let { chatSummaries, chatUpdatesSince } = ctx;
            let intervalId: number | undefined;

            const unsubBackground = background.subscribe((hidden) => {
                intervalId = poll(hidden ? CHAT_UPDATE_IDLE_INTERVAL : CHAT_UPDATE_INTERVAL);
            });

            receive((ev) => {
                // we need to capture the latest state of the parent machine whenever it changes
                // still feel a bit uneasy about this
                if (ev.type === "SYNC_WITH_POLLER") {
                    chatSummaries = ev.data.chatSummaries;
                    chatUpdatesSince = ev.data.chatUpdatesSince;
                }
            });

            function poll(interval: number): number {
                intervalId && window.clearInterval(intervalId);
                return window.setInterval(async () => {
                    callback({
                        type: "CHATS_UPDATED",
                        data: await getUpdates(
                            ctx.user!,
                            ctx.serviceContainer!,
                            ctx.markRead,
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
                        Object.keys(get(userStore)),
                        ctx.usersLastUpdate
                    );
                    console.log("sending updated users");
                    userStore.addMany(usersResp.users);
                    callback({
                        type: "USERS_UPDATED",
                        data: {
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
                {
                    id: "webRtcMessageHandler",
                    src: "webRtcMessageHandler",
                },
            ],
            on: {
                REMOTE_USER_READ_MESSAGE: {
                    actions: pure((_ctx, ev) => {
                        unconfirmedReadByThem.add(BigInt(ev.data.messageId));
                        return undefined;
                    }),
                },
                REMOTE_USER_SENT_MESSAGE: {
                    actions: [
                        pure((ctx, ev) => {
                            unconfirmed.add(BigInt(ev.data.messageEvent.event.messageId));
                            sendMessageToChatBasedOnUser(ctx, ev.data, (chat) =>
                                chat.sendMessage(ev.data.messageEvent, ev.data.userId)
                            );
                            return undefined;
                        }),
                    ],
                },
                REMOTE_USER_UNDELETED_MESSAGE: {
                    actions: pure((ctx, ev) => {
                        sendMessageToChatBasedOnUser(ctx, ev.data, (chat) =>
                            chat.undeleteMessage(ev.data.message, ev.data.userId)
                        );
                        return undefined;
                    }),
                },
                REMOTE_USER_DELETED_MESSAGE: {
                    actions: pure((ctx, ev) => {
                        sendMessageToChatBasedOnUser(ctx, ev.data, (chat) =>
                            chat.deleteMessage(ev.data.messageId, ev.data.userId)
                        );
                        return undefined;
                    }),
                },
                REMOTE_USER_REMOVED_MESSAGE: {
                    actions: pure((ctx, ev) => {
                        sendMessageToChatBasedOnUser(ctx, ev.data, (chat) =>
                            chat.removeMessage(ev.data.messageId, ev.data.userId)
                        );
                        return undefined;
                    }),
                },
                REMOTE_USER_TOGGLED_REACTION: {
                    actions: pure((ctx, ev) => {
                        sendMessageToChatBasedOnUser(ctx, ev.data, (chat) =>
                            chat.toggleReaction(ev.data.messageId, ev.data.reaction, ev.data.userId)
                        );
                        return undefined;
                    }),
                },
                UPDATE_USER_AVATAR: {
                    actions: assign((ctx, ev) => {
                        if (ctx.user) {
                            const user = {
                                ...ctx.user,
                                ...ev.data,
                            };
                            const partialUser = get(userStore)[ctx.user.userId];
                            if (partialUser) {
                                userStore.add({
                                    ...partialUser,
                                    ...ev.data,
                                });
                            }
                            return {
                                user: user,
                            };
                        }
                        return {};
                    }),
                },
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
                            if (ctx.selectedChat !== undefined) {
                                ev.data.chatSummaries.forEach((chat) => {
                                    if (chat.chatId === ctx.selectedChat!.chatId) {
                                        ctx.selectedChat?.chatUpdated(chat);
                                    }
                                });
                            }
                            return undefined;
                        }),
                    ],
                },
                GO_TO_MESSAGE_INDEX: {
                    actions: pure((ctx, ev) => {
                        ctx.selectedChat?.goToMessageIndex(ev.data);
                        return undefined;
                    }),
                },
                SELECT_CHAT: {
                    internal: true,
                    cond: "selectedChatIsValid",
                    target: ".chat_selected",
                    actions: [
                        pure((_ctx, ev) => {
                            closeNotificationsForChat(ev.data.chatId);
                            return undefined;
                        }),
                        assign((ctx, ev) => {
                            const chatSummary = ctx.chatSummaries.find(
                                (c) => c.chatId === ev.data.chatId
                            );
                            if (chatSummary) {
                                const user = {
                                    userId: ctx.user!.userId,
                                    username: ctx.user!.username,
                                    lastOnline: Date.now(),
                                };
                                if (ctx.selectedChat !== undefined) {
                                    ctx.selectedChat.destroy();
                                }
                                return {
                                    selectedChat: new ChatController(
                                        ctx.serviceContainer!,
                                        user,
                                        chatSummary,
                                        ctx.markRead,
                                        ctx.replyingTo,
                                        ev.data.messageIndex
                                            ? Number(ev.data.messageIndex)
                                            : undefined
                                    ),
                                    replyingTo: undefined,
                                };
                            }
                            return { selectedChat: undefined };
                        }),
                        send((ctx, _) => ({ type: "SYNC_WITH_RTC_HANDLER", data: ctx }), {
                            to: "webRtcMessageHandler",
                        }),
                    ],
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
                                dateCreated: BigInt(Date.now()),
                                notificationsMuted: false,
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
                                dateCreated: BigInt(Date.now()),
                                notificationsMuted: false,
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
            },
            states: {
                no_chat_selected: {},
                chat_selected: {
                    entry: log("entering the chat_selected state"),
                },
                new_chat: {
                    entry: log("entering new chat"),
                    on: {
                        // todo - actually we would like to go back to where we were
                        CANCEL_NEW_CHAT: "no_chat_selected",
                        CREATE_CHAT_WITH_USER: {
                            actions: [
                                assign((ctx, ev) => {
                                    const dummyChat: DirectChatSummary = {
                                        kind: "direct_chat",
                                        them: ev.data.userId,
                                        chatId: ev.data.userId,
                                        readByMe: [],
                                        readByThem: [],
                                        latestMessage: undefined,
                                        latestEventIndex: 0,
                                        dateCreated: BigInt(Date.now()),
                                        notificationsMuted: false,
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
