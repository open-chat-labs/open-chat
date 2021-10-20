/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { createMachine, DoneInvokeEvent, MachineConfig, MachineOptions } from "xstate";
import { assign, pure, send, sendParent } from "xstate/lib/actions";
import type {
    ChatSummary,
    EventsResponse,
    EventWrapper,
    EnhancedReplyContext,
    MessageContent,
    ChatEvent,
    SendMessageSuccess,
    Message,
    LocalReaction,
} from "../domain/chat/chat";
import {
    containsReaction,
    earliestLoadedEventIndex,
    eventIsVisible,
    getMinVisibleEventIndex,
    indexRangeForChat,
    latestLoadedEventIndex,
    pruneLocalReactions,
    replaceAffected,
    setLastMessageOnChat,
    toggleReaction,
    userIdsFromChatSummaries,
    replaceLocal,
    userIdsFromChatSummary,
    replaceMessageContent,
    serialiseMessageForRtc,
} from "../domain/chat/chat.utils";
import type { UserSummary } from "../domain/user/user";
import { missingUserIds } from "../domain/user/user.utils";
import type { ServiceContainer } from "../services/serviceContainer";
import { toastStore } from "../stores/toast";
import { chatStore } from "../stores/chat";
import { overwriteCachedEvents } from "../utils/caching";
import { rtcConnectionsManager } from "../domain/webrtc/RtcConnectionsManager";
import { unconfirmed } from "../stores/unconfirmed";
import { get } from "svelte/store";
import { userStore } from "../stores/user";
import type { MessageReadTracker } from "../stores/markRead";

const PRUNE_LOCAL_REACTIONS_INTERVAL = 30 * 1000;

export interface ChatContext {
    serviceContainer: ServiceContainer;
    chatSummary: ChatSummary;
    user?: UserSummary;
    error?: Error;
    events: EventWrapper<ChatEvent>[];
    focusMessageIndex?: number; // this is the index of a message that we want to scroll to
    replyingTo?: EnhancedReplyContext;
    fileToAttach?: MessageContent;
    localReactions: Record<string, LocalReaction[]>;
    editingEvent?: EventWrapper<Message>;
    markRead: MessageReadTracker;
    initialised: boolean;
    sendingMessage?: SendMessageEvent;
}

type LoadEventsResponse = {
    events: EventWrapper<ChatEvent>[];
    affectedEvents: EventWrapper<ChatEvent>[];
};

type SendMessageEvent = {
    type: "SEND_MESSAGE";
    data: { messageEvent: EventWrapper<Message>; userId: string };
};

export type ChatEvents =
    | {
          type: "done.invoke.loadEventsAndUsers";
          data: LoadEventsResponse | undefined;
      }
    | { type: "error.platform.loadEventsAndUsers"; data: Error }
    | { type: "error.platform.sendMessage"; data: Error }
    | { type: "GO_TO_MESSAGE_INDEX"; data: number }
    | { type: "SET_FOCUS_MESSAGE_INDEX"; data: number }
    | { type: "EDIT_EVENT"; data: EventWrapper<Message> }
    | { type: "START_TYPING" }
    | { type: "STOP_TYPING" }
    | SendMessageEvent
    | { type: "TOGGLE_REACTION"; data: { messageId: bigint; reaction: string; userId: string } }
    | { type: "REMOVE_MESSAGE"; data: { userId: string; messageId: bigint } }
    | {
          type: "UPDATE_MESSAGE";
          data: { candidate: Message; resp: SendMessageSuccess };
      }
    | { type: "ATTACH_FILE"; data: MessageContent }
    | { type: "CLEAR_ATTACHMENT" }
    | { type: "PRUNE_LOCAL_REACTIONS" }
    | { type: "CLEAR_FOCUS_INDEX" }
    | {
          type: "REPLY_TO";
          data: EnhancedReplyContext;
      }
    | {
          type: "REPLY_PRIVATELY_TO";
          data: EnhancedReplyContext;
      }
    | {
          type: "DELETE_MESSAGE";
          data: { messageId: bigint; userId: string };
      }
    | {
          type: "UNDELETE_MESSAGE";
          data: { message: Message; userId: string };
      }
    | { type: "CANCEL_REPLY_TO" }
    | { type: "TOGGLE_MUTE_NOTIFICATIONS" }
    | { type: "CHAT_UPDATED"; data: ChatSummary }
    | { type: "LOAD_PREVIOUS_MESSAGES" }
    | { type: "LOAD_NEW_MESSAGES" };

async function loadUsersForChat(
    serviceContainer: ServiceContainer,
    chatSummary: ChatSummary
): Promise<void> {
    if (chatSummary.kind === "group_chat") {
        const userIds = userIdsFromChatSummaries([chatSummary], true);
        const { users } = await serviceContainer.getUsers(
            missingUserIds(get(userStore), userIds),
            BigInt(0) // timestamp irrelevant for missing users
        );
        userStore.addMany(users);
    }
}

function loadEvents(
    ev: ChatEvents,
    serviceContainer: ServiceContainer,
    chatSummary: ChatSummary,
    startIndex: number,
    ascending: boolean
): Promise<EventsResponse<ChatEvent>> {
    if (chatSummary.kind === "direct_chat") {
        if (ev.type === "GO_TO_MESSAGE_INDEX") {
            return serviceContainer.directChatEventsWindow(
                indexRangeForChat(chatSummary),
                chatSummary.them,
                startIndex
            );
        } else {
            return serviceContainer.directChatEvents(
                indexRangeForChat(chatSummary),
                chatSummary.them,
                startIndex,
                ascending
            );
        }
    }
    if (ev.type === "GO_TO_MESSAGE_INDEX") {
        return serviceContainer.groupChatEventsWindow(
            indexRangeForChat(chatSummary),
            chatSummary.chatId,
            startIndex
        );
    } else {
        return serviceContainer.groupChatEvents(
            indexRangeForChat(chatSummary),
            chatSummary.chatId,
            startIndex,
            ascending
        );
    }
}

export function morePreviousMessagesAvailable(ctx: ChatContext): boolean {
    return earliestIndex(ctx) > earliestAvailableEventIndex(ctx);
}

export function earliestAvailableEventIndex(ctx: ChatContext): number {
    return ctx.chatSummary.kind === "group_chat" ? ctx.chatSummary.minVisibleEventIndex : 0;
}

// we need to be clearer about what this means
export function earliestIndex(ctx: ChatContext): number {
    return earliestLoadedEventIndex(ctx.events) ?? ctx.chatSummary.latestEventIndex;
}

export function moreNewMessagesAvailable(ctx: ChatContext): boolean {
    const lastLoaded = latestLoadedEventIndex(ctx.events, get(unconfirmed));
    return lastLoaded === undefined || lastLoaded < ctx.chatSummary.latestEventIndex;
}

export function newMessageCriteria(ctx: ChatContext): [number, boolean] | undefined {
    const lastLoaded = latestLoadedEventIndex(ctx.events, get(unconfirmed));
    if (lastLoaded !== undefined && lastLoaded < ctx.chatSummary.latestEventIndex) {
        const from = lastLoaded + 1;
        return [from, true];
    } else {
        // this implies that we have not loaded any messages which should never happen
        return undefined;
    }
}

/**
 * This gives us the highest index that we have not yet loaded
 */
export function highestUnloadedEventIndex(ctx: ChatContext): number {
    const earliestLoaded = earliestLoadedEventIndex(ctx.events);
    if (earliestLoaded !== undefined) {
        return earliestLoaded - 1; // the one before the first one we *have* loaded
    } else {
        return ctx.chatSummary.latestEventIndex; //or the latest index if we haven't loaded *any*
    }
}

/**
 * This gives us the range of messages that we must request when loading *previous* messages
 * todo - this no longer deals with zooming to a specific historical message
 * we need to come up with an all new mechanism for that. Probably recursively calling the
 * service until a specific message is available.
 */
export function previousMessagesCriteria(ctx: ChatContext): [number, boolean] | undefined {
    const start = highestUnloadedEventIndex(ctx);
    const min = getMinVisibleEventIndex(ctx.chatSummary);
    return start >= min ? [start, false] : undefined;
}

export function requiredCriteria(ctx: ChatContext, ev: ChatEvents): [number, boolean] | undefined {
    if (ev.type === "LOAD_NEW_MESSAGES") {
        return newMessageCriteria(ctx);
    } else {
        if (ev.type === "GO_TO_MESSAGE_INDEX") {
            return [ctx.focusMessageIndex!, false];
        } else {
            return previousMessagesCriteria(ctx);
        }
    }
}

const liveConfig: Partial<MachineOptions<ChatContext, ChatEvents>> = {
    guards: {
        notUpToDate: (ctx, ev) =>
            ev.type === "SEND_MESSAGE" &&
            ctx.events[ctx.events.length - 1]?.index < ctx.chatSummary.latestEventIndex &&
            ev.data.userId === ctx.user?.userId &&
            ctx.chatSummary.latestMessage !== undefined,

        upToDate: (ctx, _) =>
            ctx.events[ctx.events.length - 1]?.index >= ctx.chatSummary.latestEventIndex &&
            ctx.chatSummary.latestMessage !== undefined,
    },
    services: {
        loadEventsAndUsers: async (ctx, ev) => {
            const criteria = requiredCriteria(ctx, ev);

            const [, eventsResponse] = await Promise.all([
                loadUsersForChat(ctx.serviceContainer, ctx.chatSummary),
                criteria
                    ? loadEvents(
                          ev,
                          ctx.serviceContainer!,
                          ctx.chatSummary,
                          criteria[0],
                          criteria[1]
                      )
                    : undefined,
            ]);

            if (eventsResponse === undefined || eventsResponse === "events_failed") {
                return undefined;
            }

            return {
                events: eventsResponse.events,
                affectedEvents: eventsResponse.affectedEvents,
            };
        },
        pruneLocalReactions: (_ctx, _ev) => (callback) => {
            const intervalId = setInterval(
                () => callback("PRUNE_LOCAL_REACTIONS"),
                PRUNE_LOCAL_REACTIONS_INTERVAL
            );

            return () => {
                console.log("stopping the local reactions pruner");
                clearInterval(intervalId);
            };
        },
    },
    actions: {
        assignEventsResponse: assign((ctx, ev) => {
            if (ev.type !== "done.invoke.loadEventsAndUsers" || ev.data === undefined) {
                return {};
            }
            return {
                initialised: true,
                events: replaceAffected(
                    ctx.chatSummary.chatId,
                    replaceLocal(
                        ctx.user!.userId,
                        ctx.chatSummary.chatId,
                        ctx.markRead,
                        ctx.focusMessageIndex === undefined ? ctx.events : [],
                        ev.data.events
                    ),
                    ev.data.affectedEvents,
                    ctx.localReactions
                ),
            };
        }),
    },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const schema: MachineConfig<ChatContext, any, ChatEvents> = {
    id: "chat_machine",
    type: "parallel",
    states: {
        pruning_local_reactions: {
            initial: "pruning",
            states: {
                pruning: {
                    invoke: {
                        id: "pruneLocalReactions",
                        src: "pruneLocalReactions",
                    },
                    on: {
                        PRUNE_LOCAL_REACTIONS: {
                            actions: assign((ctx, _) => ({
                                localReactions: pruneLocalReactions(ctx.localReactions),
                            })),
                        },
                    },
                },
            },
        },
        loading_new_messages: {
            meta: "This is a parallel state that controls the loading of *new* messages triggered by polling",
            initial: "idle",
            on: {
                LOAD_NEW_MESSAGES: {
                    cond: (ctx, _ev) => ctx.initialised,
                    target: ".loading",
                    internal: true,
                },
                // update the chat and trigger an event that we can pick up in the UI
                CHAT_UPDATED: {
                    actions: [
                        assign((_, ev) => {
                            return { chatSummary: ev.data };
                        }),
                        pure((ctx, _ev) => {
                            chatStore.set({
                                chatId: ctx.chatSummary.chatId,
                                event: { kind: "chat_updated" },
                            });
                            return undefined;
                        }),
                    ],
                },
            },
            states: {
                idle: {},
                loading: {
                    invoke: {
                        id: "loadEventsAndUsers",
                        src: "loadEventsAndUsers",
                        onDone: {
                            target: "idle",
                            actions: [
                                "assignEventsResponse",
                                pure((ctx, ev: DoneInvokeEvent<LoadEventsResponse>) => {
                                    if (
                                        ev.data !== undefined &&
                                        ev.data.events.some(eventIsVisible)
                                    ) {
                                        chatStore.set({
                                            chatId: ctx.chatSummary.chatId,
                                            event: { kind: "loaded_new_messages" },
                                        });
                                    }
                                    return undefined;
                                }),
                            ],
                        },
                        onError: {
                            target: "error",
                            actions: assign({
                                error: (_, { data }) => data,
                            }),
                        },
                    },
                },
                error: {
                    //todo - what does this do?
                },
            },
        },
        user_states: {
            meta: "This is a parent state for all states that the user cares about or the UI should reflect",
            initial: "loading_previous_messages",
            on: {
                START_TYPING: {
                    actions: pure((ctx, _ev) => {
                        rtcConnectionsManager.sendMessage(userIdsFromChatSummary(ctx.chatSummary), {
                            kind: "remote_user_typing",
                            chatType: ctx.chatSummary.kind,
                            chatId: ctx.chatSummary.chatId,
                            userId: ctx.user!.userId,
                        });
                        return undefined;
                    }),
                },
                STOP_TYPING: {
                    actions: pure((ctx, _ev) => {
                        rtcConnectionsManager.sendMessage(userIdsFromChatSummary(ctx.chatSummary), {
                            kind: "remote_user_stopped_typing",
                            chatType: ctx.chatSummary.kind,
                            chatId: ctx.chatSummary.chatId,
                            userId: ctx.user!.userId,
                        });
                        return undefined;
                    }),
                },
                SEND_MESSAGE: [
                    {
                        cond: "notUpToDate",
                        actions: [
                            // set focus to the last confirmed message
                            assign((ctx, ev) => {
                                console.log("are we ending up here");
                                return {
                                    focusMessageIndex:
                                        ctx.chatSummary.latestMessage!.event.messageIndex,
                                    sendingMessage: ev,
                                };
                            }),
                            // load the message window around that message
                            send((ctx, _) => {
                                return {
                                    type: "GO_TO_MESSAGE_INDEX",
                                    data: ctx.chatSummary.latestMessage!.event.messageIndex,
                                };
                            }),
                        ],
                    },
                    {
                        cond: "upToDate",
                        actions: assign((ctx, ev) => {
                            if (ctx.editingEvent) {
                                return {
                                    events: ctx.events.map((e) => {
                                        if (
                                            e.event.kind === "message" &&
                                            e.event.messageId ===
                                                ev.data.messageEvent.event.messageId
                                        ) {
                                            return ev.data.messageEvent;
                                        }
                                        return e;
                                    }),
                                    replyingTo: undefined,
                                    fileToAttach: undefined,
                                    editingEvent: undefined,
                                    sendingMessage: undefined,
                                    focusMessageIndex: undefined,
                                };
                            } else {
                                unconfirmed.add(ev.data.messageEvent.event.messageId);

                                // this message may have come in via webrtc
                                const sentByMe = ev.data.userId === ctx.user?.userId;
                                if (sentByMe) {
                                    rtcConnectionsManager.sendMessage(
                                        userIdsFromChatSummary(ctx.chatSummary),
                                        {
                                            kind: "remote_user_sent_message",
                                            chatType: ctx.chatSummary.kind,
                                            chatId: ctx.chatSummary.chatId,
                                            messageEvent: serialiseMessageForRtc(
                                                ev.data.messageEvent
                                            ),
                                            userId: ev.data.userId,
                                        }
                                    );
                                    // mark our own messages as read manually since we will not be observing them
                                    ctx.markRead.markMessageRead(
                                        ctx.chatSummary.chatId,
                                        ev.data.messageEvent.event.messageIndex,
                                        ev.data.messageEvent.event.messageId
                                    );
                                }
                                chatStore.set({
                                    chatId: ctx.chatSummary.chatId,
                                    event: {
                                        kind: "sending_message",
                                        messageIndex: ev.data.messageEvent.event.messageIndex,
                                        sentByMe,
                                        scroll:
                                            ctx.sendingMessage === undefined ? "smooth" : "auto",
                                    },
                                });
                                const chatSummary = sentByMe
                                    ? setLastMessageOnChat(ctx.chatSummary, ev.data.messageEvent)
                                    : ctx.chatSummary;
                                return {
                                    chatSummary,
                                    events: [...ctx.events, ev.data.messageEvent],
                                    replyingTo: undefined,
                                    fileToAttach: undefined,
                                    editingEvent: undefined,
                                    sendingMessage: undefined,
                                    focusMessageIndex: undefined,
                                };
                            }
                        }),
                    },
                ],
                EDIT_EVENT: {
                    actions: assign((ctx, ev) => ({
                        editingEvent: ev.data,
                        fileToAttach:
                            ev.data.event.content.kind !== "text_content"
                                ? ev.data.event.content
                                : undefined,
                        replyingTo:
                            ev.data.event.repliesTo &&
                            ev.data.event.repliesTo.kind === "rehydrated_reply_context"
                                ? {
                                      ...ev.data.event.repliesTo,
                                      content: ev.data.event.content,
                                      sender: get(userStore)[ev.data.event.sender],
                                  }
                                : undefined,
                    })),
                },
                UPDATE_MESSAGE: {
                    actions: assign((ctx, ev) => ({
                        events: ctx.events.map((e) => {
                            if (e.event === ev.data.candidate) {
                                return {
                                    event: {
                                        ...e.event,
                                        messageIndex: ev.data.resp.messageIndex,
                                    },
                                    index: ev.data.resp.eventIndex,
                                    timestamp: ev.data.resp.timestamp,
                                };
                            }
                            return e;
                        }),
                    })),
                },
                UNDELETE_MESSAGE: {
                    actions: assign((ctx, ev) => {
                        if (ev.data.userId === ctx.user?.userId) {
                            rtcConnectionsManager.sendMessage(
                                userIdsFromChatSummary(ctx.chatSummary),
                                {
                                    kind: "remote_user_undeleted_message",
                                    chatType: ctx.chatSummary.kind,
                                    chatId: ctx.chatSummary.chatId,
                                    message: ev.data.message,
                                    userId: ev.data.userId,
                                }
                            );
                        }

                        return {
                            events: replaceMessageContent(
                                ctx.events,
                                BigInt(ev.data.message.messageId),
                                ev.data.message.content
                            ),
                        };
                    }),
                },
                DELETE_MESSAGE: {
                    actions: assign((ctx, ev) => {
                        if (ev.data.userId === ctx.user?.userId) {
                            rtcConnectionsManager.sendMessage(
                                userIdsFromChatSummary(ctx.chatSummary),
                                {
                                    kind: "remote_user_deleted_message",
                                    chatType: ctx.chatSummary.kind,
                                    chatId: ctx.chatSummary.chatId,
                                    messageId: ev.data.messageId,
                                    userId: ev.data.userId,
                                }
                            );
                        }
                        return {
                            events: replaceMessageContent(ctx.events, BigInt(ev.data.messageId), {
                                kind: "deleted_content",
                                deletedBy: ev.data.userId,
                                timestamp: BigInt(+new Date()),
                            }),
                        };
                    }),
                },
                TOGGLE_REACTION: {
                    actions: assign((ctx, ev) => {
                        const messageId = BigInt(ev.data.messageId);
                        const key = messageId.toString();
                        if (ctx.localReactions[key] === undefined) {
                            ctx.localReactions[key] = [];
                        }
                        const messageReactions = ctx.localReactions[key];
                        return {
                            events: ctx.events.map((e) => {
                                if (e.event.kind === "message" && e.event.messageId === messageId) {
                                    const addOrRemove = containsReaction(
                                        ev.data.userId,
                                        ev.data.reaction,
                                        e.event.reactions
                                    )
                                        ? "remove"
                                        : "add";
                                    messageReactions.push({
                                        reaction: ev.data.reaction,
                                        timestamp: +new Date(),
                                        kind: addOrRemove,
                                        userId: ev.data.userId,
                                    });
                                    const updatedEvent = {
                                        ...e,
                                        event: {
                                            ...e.event,
                                            reactions: toggleReaction(
                                                ev.data.userId,
                                                e.event.reactions,
                                                ev.data.reaction
                                            ),
                                        },
                                    };
                                    overwriteCachedEvents(ctx.chatSummary.chatId, [updatedEvent]);
                                    if (ev.data.userId === ctx.user?.userId) {
                                        rtcConnectionsManager.sendMessage(
                                            userIdsFromChatSummary(ctx.chatSummary),
                                            {
                                                kind: "remote_user_toggled_reaction",
                                                chatType: ctx.chatSummary.kind,
                                                chatId: ctx.chatSummary.chatId,
                                                messageId: messageId,
                                                userId: ev.data.userId,
                                                reaction: ev.data.reaction,
                                            }
                                        );
                                    }
                                    return updatedEvent;
                                }
                                return e;
                            }),
                        };
                    }),
                },
                REMOVE_MESSAGE: {
                    actions: assign((ctx, ev) => {
                        if (ev.data.userId === ctx.user?.userId) {
                            rtcConnectionsManager.sendMessage(
                                userIdsFromChatSummary(ctx.chatSummary),
                                {
                                    kind: "remote_user_removed_message",
                                    chatType: ctx.chatSummary.kind,
                                    chatId: ctx.chatSummary.chatId,
                                    messageId: ev.data.messageId,
                                    userId: ev.data.userId,
                                }
                            );
                        }
                        unconfirmed.delete(ev.data.messageId);
                        return {
                            events: ctx.events.filter(
                                (e) =>
                                    e.event.kind === "message" &&
                                    e.event.messageId !== ev.data.messageId
                            ),
                        };
                    }),
                },
                TOGGLE_MUTE_NOTIFICATIONS: {
                    actions: assign((ctx, _ev) => ({
                        chatSummary: {
                            ...ctx.chatSummary,
                            notificationsMuted: !ctx.chatSummary.notificationsMuted,
                        },
                    })),
                },
                LOAD_PREVIOUS_MESSAGES: ".loading_previous_messages",
                CLEAR_FOCUS_INDEX: {
                    actions: assign((_, _ev) => ({
                        focusMessageIndex: undefined,
                    })),
                },
                REPLY_TO: {
                    actions: assign((_, ev) => ({ replyingTo: ev.data })),
                },
                REPLY_PRIVATELY_TO: {
                    // this involved switching / creating a chat so we need to bubble to the parent machine
                    actions: sendParent((_, ev) => ev),
                },
                CANCEL_REPLY_TO: {
                    actions: assign((_, _ev) => ({ replyingTo: undefined })),
                },
                // this will only be called if the message with the required message index is
                // not already rendered. If it *is* we can simply scroll to it. If not, we need to load it first.
                GO_TO_MESSAGE_INDEX: {
                    target: ".loading_previous_messages",
                    actions: assign((_, ev) => ({
                        focusMessageIndex: ev.data,
                    })),
                },
                SET_FOCUS_MESSAGE_INDEX: {
                    actions: assign((_, ev) => ({
                        focusMessageIndex: ev.data,
                    })),
                },
                ATTACH_FILE: {
                    actions: assign((_, ev) => ({
                        fileToAttach: ev.data,
                    })),
                },
                CLEAR_ATTACHMENT: {
                    actions: assign((_, _ev) => ({
                        fileToAttach: undefined,
                    })),
                },
            },
            states: {
                idle: { id: "ui_idle" },
                loading_previous_messages: {
                    initial: "loading",
                    meta: "Triggered by selecting a chat, scrolling up, or by clicking a link to a previous message",
                    states: {
                        idle: {},
                        loading: {
                            invoke: {
                                id: "loadEventsAndUsers",
                                src: "loadEventsAndUsers",
                                onDone: {
                                    target: "#ui_idle",
                                    actions: [
                                        "assignEventsResponse",
                                        pure((ctx, _ev: DoneInvokeEvent<LoadEventsResponse>) => {
                                            if (ctx.sendingMessage !== undefined) {
                                                return send(ctx.sendingMessage);
                                            } else {
                                                chatStore.set({
                                                    chatId: ctx.chatSummary.chatId,
                                                    event: { kind: "loaded_previous_messages" },
                                                });
                                                return undefined;
                                            }
                                        }),
                                    ],
                                },
                                onError: {
                                    target: "error",
                                    actions: assign({
                                        error: (_, { data }) => data,
                                    }),
                                },
                            },
                        },
                        error: {
                            entry: pure((ctx, _) => {
                                toastStore.showFailureToast(ctx.error?.stack ?? "error");
                                return undefined;
                            }),
                        },
                    },
                },
            },
        },
    },
};

export const chatMachine = createMachine<ChatContext, ChatEvents>(schema, liveConfig);
export type ChatMachine = typeof chatMachine;
