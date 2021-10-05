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
    DirectChatSummary,
    EnhancedReplyContext,
    GroupChatSummary,
} from "../domain/chat/chat";
import {
    insertIndexIntoRanges,
    setMessageRead,
    updateArgsFromChats,
    userIdsFromChatSummaries,
    userIdsFromChatSummary,
} from "../domain/chat/chat.utils";
import type { User, UsersResponse, UserSummary } from "../domain/user/user";
import { missingUserIds, userIsOnline } from "../domain/user/user.utils";
import { rollbar } from "../utils/logging";
import { log, pure, send } from "xstate/lib/actions";
import { ChatEvents, chatMachine, ChatMachine } from "./chat.machine";
import { userSearchMachine } from "./userSearch.machine";
import { push } from "svelte-spa-router";
import { background } from "../stores/background";
import { addGroupMachine, nullGroup } from "./addgroup.machine";
import type { DataContent } from "../domain/data/data";
import { rtcConnectionsManager } from "../domain/webrtc/RtcConnectionsManager";
import { unconfirmed, unconfirmedReadByThem, unconfirmedReadByUs } from "../stores/unconfirmed";
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
import type { MessageReadTracker } from "../stores/markRead";
import { userStore } from "../stores/user";

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
    usersLastUpdate: bigint;
    chatsIndex: ChatsIndex; //an index of all chat actors
    chatUpdatesSince?: bigint; // first time through this will be undefined
    replyingTo?: EnhancedReplyContext;
    markRead: MessageReadTracker;
}

export type HomeEvents =
    | { type: "SELECT_CHAT"; data: { chatId: string; eventIndex: string | undefined } }
    | { type: "NEW_CHAT" }
    | { type: "NEW_GROUP" }
    | { type: "JOIN_GROUP" }
    | { type: "CANCEL_JOIN_GROUP" }
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
    | { type: "GO_TO_EVENT_INDEX"; data: number }
    | { type: "CANCEL_NEW_CHAT" }
    | { type: "CLEAR_SELECTED_CHAT" }
    | { type: "UPDATE_USER_AVATAR"; data: DataContent }
    | { type: "REPLY_PRIVATELY_TO"; data: EnhancedReplyContext }
    | {
          type: "MESSAGE_READ_BY_ME";
          data: { chatId: string; messageIndex: number; messageId: bigint };
      }
    | { type: "SYNC_WITH_POLLER"; data: HomeContext }
    | { type: "CHATS_UPDATED"; data: ChatsResponse }
    | { type: "LEAVE_GROUP"; data: string }
    | { type: "USERS_UPDATED"; data: UserUpdateResponse }
    | { type: "done.invoke.getUpdates"; data: ChatsResponse }
    | { type: "error.platform.getUpdates"; data: Error }
    | { type: "done.invoke.addGroupMachine"; data: GroupChatSummary }
    | { type: "error.platform.addGroupMachine"; data: Error }
    | { type: "done.invoke.userSearchMachine"; data: UserSummary }
    | { type: "error.platform.userSearchMachine"; data: Error };

type ChatsIndex = Record<string, ActorRefFrom<ChatMachine>>;

type ChatsResponse = {
    chatSummaries: ChatSummary[];
    chatUpdatesSince: bigint;
    usersLastUpdate: bigint;
    blockedUsers: Set<string>;
};
type UserUpdateResponse = { usersLastUpdate: bigint };

function findDirectChatByUserId(ctx: HomeContext, userId: string): DirectChatSummary | undefined {
    return ctx.chatSummaries.find((c) => c.kind === "direct_chat" && c.them === userId) as
        | DirectChatSummary
        | undefined;
}

function sendMessageToChatBasedOnUser(ctx: HomeContext, userId: string, chatMsg: ChatEvents): void {
    const chat = findDirectChatByUserId(ctx, userId);
    const actor = chat ? ctx.chatsIndex[chat.chatId] : undefined;
    if (actor) {
        actor.send(chatMsg);
    }
}

// async function handleWebRtcConnections(
//     myUserId: string,
//     serviceContainer: ServiceContainer,
//     rtcEvents: WebRtcSessionDetailsEvent[]
// ): Promise<void> {
//     const sorted = rtcEvents.sort((a, b) => Number(a.timestamp) - Number(b.timestamp));

//     // if we have two from the same user we just take the later one, that's why we are sorting and flattening
//     const [offers, remoteAnswers]: [Record<string, WebRtcOffer>, Record<string, WebRtcAnswer>] =
//         sorted.reduce(
//             ([offers, remoteAnswers], ev) => {
//                 if (ev.sessionDetails.kind === "offer") {
//                     offers[ev.sessionDetails.fromUserId] = ev.sessionDetails;
//                 }
//                 if (ev.sessionDetails.kind === "answer") {
//                     remoteAnswers[ev.sessionDetails.fromUserId] = ev.sessionDetails;
//                 }
//                 return [offers, remoteAnswers];
//             },
//             [{}, {}] as [Record<string, WebRtcOffer>, Record<string, WebRtcAnswer>]
//         );

//     const sentAnswers = Object.values(offers).map((offer) => {
//         // this little trick is necesary in case both ends initiate the connection at the same time
//         if (rtcConnectionsManager.exists(offer.fromUserId) && offer.fromUserId > myUserId) {
//             console.log("we already have a connection with user: ", offer.fromUserId);
//             console.log(
//                 "Since I have the lower userId, we will ignore this offer and let them progress the connection"
//             );
//             return;
//         }

//         return rtcConnectionsManager.createAnswer(myUserId, offer).then((answer) =>
//             serviceContainer
//                 .webRtcAnswer(offer.fromUserId, answer)
//                 .then((resp) => {
//                     if (resp !== "success") {
//                         console.log("WebRtc answer failed: ", resp);
//                     }
//                 })
//                 .catch((err) => {
//                     console.log("WebRtc answer failed: ", err);
//                 })
//         );
//     });

//     const receivedAnswers = Object.values(remoteAnswers).map((r) =>
//         rtcConnectionsManager.handleRemoteAnswer(r)
//     );

//     await Promise.all([...sentAnswers, ...receivedAnswers]);
// }

async function getUpdates(
    user: User,
    serviceContainer: ServiceContainer,
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
        userIds.add(user.userId);
        const usersResponse = await serviceContainer.getUsers(
            missingUserIds(get(userStore), userIds),
            BigInt(0)
        );

        userStore.addMany(usersResponse.users);
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
    actions: {
        sendWebRtcOffers: pure((ctx, ev) => {
            if (ev.type === "SELECT_CHAT") {
                const chat = ctx.chatSummaries.find((c) => c.chatId === ev.data.chatId);
                if (chat && chat.kind === "direct_chat") {
                    if (
                        !rtcConnectionsManager.exists(chat.them) &&
                        userIsOnline(get(userStore), chat.them)
                    ) {
                        rtcConnectionsManager.create(ctx.user!.userId, chat.them);
                    }
                }
            }
            return undefined;
        }),
    },
    services: {
        getUpdates: async (ctx, _) =>
            getUpdates(ctx.user!, ctx.serviceContainer!, ctx.chatSummaries, ctx.chatUpdatesSince),

        webRtcMessageHandler: (_ctx, _ev) => (callback, _receive) => {
            rtcConnectionsManager.subscribe((message: unknown) => {
                const parsedMsg = message as WebRtcMessage;
                if (parsedMsg.kind === "remote_user_typing") {
                    typing.add(parsedMsg.userId);
                }
                if (parsedMsg.kind === "remote_user_stopped_typing") {
                    typing.delete(parsedMsg.userId);
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
            let intervalId: NodeJS.Timeout | undefined;

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

            function poll(interval: number): NodeJS.Timeout {
                intervalId && clearInterval(intervalId);
                return setInterval(async () => {
                    callback({
                        type: "CHATS_UPDATED",
                        data: await getUpdates(
                            ctx.user!,
                            ctx.serviceContainer!,
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
                    // right now the message read is either confirmed or not
                    actions: assign((ctx, ev) => {
                        // if the message is unconfirmed
                        if (ev.data.messageIndex === undefined) {
                            console.log(
                                "adding message to unconfirmed by them: ",
                                ev.data.messageId
                            );
                            unconfirmedReadByThem.add(BigInt(ev.data.messageId));
                            return {};
                        } else {
                            unconfirmedReadByThem.delete(BigInt(ev.data.messageId));
                            // todo - we must also send this via CHAT_UPDATED to the chat actor
                            return {
                                chatSummaries: ctx.chatSummaries.map((c) => {
                                    if (c.chatId === ev.data.chatId && c.kind === "direct_chat") {
                                        c.readByThem = insertIndexIntoRanges(
                                            Number(ev.data.messageIndex)!,
                                            c.readByThem
                                        );
                                    }
                                    return c;
                                }),
                            };
                        }
                    }),
                },
                REMOTE_USER_SENT_MESSAGE: {
                    actions: [
                        pure((ctx, ev) => {
                            unconfirmed.add(BigInt(ev.data.messageEvent.event.messageId));
                            sendMessageToChatBasedOnUser(ctx, ev.data.userId, {
                                type: "SEND_MESSAGE",
                                data: ev.data,
                            });
                            return undefined;
                        }),
                    ],
                },
                REMOTE_USER_UNDELETED_MESSAGE: {
                    actions: pure((ctx, ev) => {
                        sendMessageToChatBasedOnUser(ctx, ev.data.userId, {
                            type: "UNDELETE_MESSAGE",
                            data: ev.data,
                        });
                        return undefined;
                    }),
                },
                REMOTE_USER_DELETED_MESSAGE: {
                    actions: pure((ctx, ev) => {
                        sendMessageToChatBasedOnUser(ctx, ev.data.userId, {
                            type: "DELETE_MESSAGE",
                            data: ev.data,
                        });
                        return undefined;
                    }),
                },
                REMOTE_USER_REMOVED_MESSAGE: {
                    actions: pure((ctx, ev) => {
                        sendMessageToChatBasedOnUser(ctx, ev.data.userId, {
                            type: "REMOVE_MESSAGE",
                            data: ev.data,
                        });
                        return undefined;
                    }),
                },
                REMOTE_USER_TOGGLED_REACTION: {
                    actions: pure((ctx, ev) => {
                        sendMessageToChatBasedOnUser(ctx, ev.data.userId, {
                            type: "TOGGLE_REACTION",
                            data: ev.data,
                        });
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
                GO_TO_EVENT_INDEX: {
                    actions: pure((ctx, ev) => {
                        if (ctx.selectedChat !== undefined) {
                            const actor = ctx.chatsIndex[ctx.selectedChat.chatId];
                            if (actor) {
                                actor.send(ev);
                            }
                        }
                        return undefined;
                    }),
                },
                SELECT_CHAT: {
                    internal: true,
                    cond: "selectedChatIsValid",
                    target: ".chat_selected",
                    actions: [
                        "sendWebRtcOffers",
                        assign((ctx, ev) => {
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
                                                user: ctx.user
                                                    ? {
                                                          userId: ctx.user.userId,
                                                          username: ctx.user.username,
                                                          secondsSinceLastOnline: 0,
                                                      }
                                                    : undefined,
                                                events: [],
                                                focusIndex: ev.data.eventIndex
                                                    ? Number(ev.data.eventIndex)
                                                    : undefined,
                                                replyingTo: ctx.replyingTo,
                                                localReactions: {},
                                            }),
                                            `chat-${key}`
                                        ),
                                    },
                                };
                            }
                            return { selectedChat: chatSummary };
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
                NEW_GROUP: {
                    internal: true,
                    target: ".new_group",
                    actions: log("received new group"),
                },
                JOIN_GROUP: {
                    internal: true,
                    target: ".join_group",
                },
                MESSAGE_READ_BY_ME: {
                    /**
                     * this is fairly horrific, but it seems to be what we have to do
                     * 1) find the chat
                     * 2) figure out if the message is confirmed or not
                     * 3) if it is setMessageRead (by index)
                     * 4) if it is not add it to an uncomfired read by us list
                     * 5) send web rtc message
                     * 6) send the updated chat to the chat actor
                     * 7) sync with the chats poller
                     */
                    actions: pure((ctx, ev) => {
                        const actor = ctx.chatsIndex[ev.data.chatId];
                        if (actor) {
                            let chat: ChatSummary | undefined = undefined;
                            const chatSummaries = ctx.chatSummaries.map((c) => {
                                if (c.chatId === ev.data.chatId) {
                                    const userIds = userIdsFromChatSummary(c);

                                    ctx.markRead.markMessageRead(
                                        c,
                                        ev.data.messageIndex,
                                        ev.data.messageId
                                    );

                                    const rtc: WebRtcMessage = {
                                        kind: "remote_user_read_message",
                                        messageId: ev.data.messageId,
                                        chatId: ev.data.chatId,
                                        userId: ctx.user!.userId,
                                    };

                                    // we must consider whether the message is confirmed or not
                                    if (!get(unconfirmed).has(BigInt(ev.data.messageId))) {
                                        chat = setMessageRead(c, ev.data.messageIndex);
                                        unconfirmedReadByUs.delete(BigInt(ev.data.messageId));
                                        rtc.messageIndex = ev.data.messageIndex;
                                        rtcConnectionsManager.sendMessage(userIds, rtc);
                                        return chat;
                                    } else {
                                        unconfirmedReadByUs.add(BigInt(ev.data.messageId));
                                        rtcConnectionsManager.sendMessage(userIds, rtc);
                                        chat = c;
                                        return c;
                                    }
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
                        id: "addGroupMachine",
                        src: addGroupMachine,
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
                                    userStore.add(ev.data);
                                    return {
                                        chatSummaries: [dummyChat, ...ctx.chatSummaries],
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
