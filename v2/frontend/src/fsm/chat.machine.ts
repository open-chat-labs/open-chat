/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { createMachine, DoneInvokeEvent, MachineConfig, MachineOptions } from "xstate";
import { assign, pure, sendParent } from "xstate/lib/actions";
import type {
    ChatSummary,
    EventsResponse,
    EventWrapper,
    EnhancedReplyContext,
    MessageContent,
    ChatEvent,
    SendMessageSuccess,
    GroupChatSummary,
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
} from "../domain/chat/chat.utils";
import type { UserSummary } from "../domain/user/user";
import { missingUserIds } from "../domain/user/user.utils";
import type { ServiceContainer } from "../services/serviceContainer";
import { editGroupMachine } from "./editgroup.machine";
import { toastStore } from "../stores/toast";
import { chatStore } from "../stores/chat";
import { overwriteCachedEvents } from "../utils/caching";
import { rtcConnectionsManager } from "../domain/webrtc/RtcConnectionsManager";
import { unconfirmed } from "../stores/unconfirmed";
import { get } from "svelte/store";
import { userStore } from "../stores/user";

const PRUNE_LOCAL_REACTIONS_INTERVAL = 30 * 1000;

export interface ChatContext {
    serviceContainer: ServiceContainer;
    chatSummary: ChatSummary;
    user?: UserSummary;
    error?: Error;
    events: EventWrapper<ChatEvent>[];
    focusIndex?: number; // this is the index of a message that we want to scroll to
    replyingTo?: EnhancedReplyContext;
    fileToAttach?: MessageContent;
    localReactions: Record<string, LocalReaction[]>;
    editingEvent?: EventWrapper<Message>;
}

type LoadEventsResponse = {
    events: EventWrapper<ChatEvent>[];
    affectedEvents: EventWrapper<ChatEvent>[];
};

export type ChatEvents =
    | {
          type: "done.invoke.loadEventsAndUsers";
          data: LoadEventsResponse;
      }
    | { type: "error.platform.loadEventsAndUsers"; data: Error }
    | { type: "error.platform.sendMessage"; data: Error }
    | { type: "GO_TO_EVENT_INDEX"; data: number }
    | { type: "EDIT_EVENT"; data: EventWrapper<Message> }
    | {
          type: "MESSAGE_READ_BY_ME";
          data: { chatId: string; messageIndex: number; messageId: bigint };
      }
    | { type: "SHOW_GROUP_DETAILS" }
    | { type: "START_TYPING" }
    | { type: "STOP_TYPING" }
    | { type: "SHOW_PARTICIPANTS" }
    | { type: "SEND_MESSAGE"; data: { messageEvent: EventWrapper<Message>; userId: string } }
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
    | { type: "ADD_PARTICIPANT" }
    | { type: "CHAT_UPDATED"; data: ChatSummary }
    | { type: "LOAD_PREVIOUS_MESSAGES" };

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
    serviceContainer: ServiceContainer,
    chatSummary: ChatSummary,
    startIndex: number,
    ascending: boolean
): Promise<EventsResponse<ChatEvent>> {
    if (chatSummary.kind === "direct_chat") {
        return serviceContainer.directChatEvents(
            indexRangeForChat(chatSummary),
            chatSummary.them,
            startIndex,
            ascending
        );
    }
    const events = serviceContainer
        .groupChatEvents(indexRangeForChat(chatSummary), chatSummary.chatId, startIndex, ascending)
        .then((resp) => {
            return resp;
        });
    return events;
}

export function moreMessagesAvailable(ctx: ChatContext): boolean {
    return earliestIndex(ctx) > earliestAvailableEventIndex(ctx);
}

export function earliestAvailableEventIndex(ctx: ChatContext): number {
    return ctx.chatSummary.kind === "group_chat" ? ctx.chatSummary.minVisibleEventIndex : 0;
}

// we need to be clearer about what this means
export function earliestIndex(ctx: ChatContext): number {
    return earliestLoadedEventIndex(ctx.events) ?? ctx.chatSummary.latestEventIndex;
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
    if (ev.type === "CHAT_UPDATED") {
        return newMessageCriteria(ctx);
    } else {
        return previousMessagesCriteria(ctx);
    }
}

const liveConfig: Partial<MachineOptions<ChatContext, ChatEvents>> = {
    guards: {},
    services: {
        loadEventsAndUsers: async (ctx, ev) => {
            const criteria = requiredCriteria(ctx, ev);

            const [, eventsResponse] = await Promise.all([
                loadUsersForChat(ctx.serviceContainer, ctx.chatSummary),
                criteria
                    ? loadEvents(ctx.serviceContainer!, ctx.chatSummary, criteria[0], criteria[1])
                    : { events: [], affectedEvents: [] },
            ]);
            return {
                events: eventsResponse === "events_failed" ? [] : eventsResponse.events,
                affectedEvents:
                    eventsResponse === "events_failed" ? [] : eventsResponse.affectedEvents,
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
        assignEventsResponse: assign((ctx, ev) =>
            ev.type === "done.invoke.loadEventsAndUsers"
                ? {
                      events: replaceAffected(
                          ctx.chatSummary.chatId,
                          replaceLocal(ctx.events, ev.data.events),
                          ev.data.affectedEvents,
                          ctx.localReactions
                      ),
                  }
                : {}
        ),
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
                CHAT_UPDATED: {
                    target: ".loading",
                    internal: true,
                    actions: assign((_, ev) => {
                        return {
                            // todo - this is a problem because it may update the
                            // latestEventIndex and the latestMessageIndex
                            // this means that we might be creating messages using the same
                            // indexes over and over.
                            chatSummary: ev.data,
                        };
                    }),
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
                                    if (ev.data.events.some(eventIsVisible)) {
                                        chatStore.set({
                                            chatId: ctx.chatSummary.chatId,
                                            event: "loaded_new_messages",
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
                            chatId: ctx.chatSummary.chatId,
                            userId: ctx.user!.userId,
                        });
                        return undefined;
                    }),
                },
                SEND_MESSAGE: {
                    actions: assign((ctx, ev) => {
                        if (ctx.editingEvent) {
                            return {
                                events: ctx.events.map((e) => {
                                    if (
                                        e.event.kind === "message" &&
                                        e.event.messageId === ev.data.messageEvent.event.messageId
                                    ) {
                                        return ev.data.messageEvent;
                                    }
                                    return e;
                                }),
                                replyingTo: undefined,
                                fileToAttach: undefined,
                                editingEvent: undefined,
                            };
                        } else {
                            // this message may have come in via webrtc
                            const sentByMe = ev.data.userId === ctx.user?.userId;
                            if (sentByMe) {
                                rtcConnectionsManager.sendMessage(
                                    userIdsFromChatSummary(ctx.chatSummary),
                                    {
                                        kind: "remote_user_sent_message",
                                        chatId: ctx.chatSummary.chatId,
                                        messageEvent: ev.data.messageEvent,
                                        userId: ev.data.userId,
                                    }
                                );
                            }
                            unconfirmed.add(ev.data.messageEvent.event.messageId);
                            chatStore.set({
                                chatId: ctx.chatSummary.chatId,
                                event: "sending_message",
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
                            };
                        }
                    }),
                },
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
                                    chatId: ctx.chatSummary.chatId,
                                    messageId: ev.data.messageId,
                                    userId: ev.data.userId,
                                }
                            );
                        }
                        return {
                            events: replaceMessageContent(ctx.events, BigInt(ev.data.messageId), {
                                kind: "deleted_content",
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
                SHOW_GROUP_DETAILS: ".showing_group",
                SHOW_PARTICIPANTS: ".showing_group",
                ADD_PARTICIPANT: ".showing_group",
                LOAD_PREVIOUS_MESSAGES: ".loading_previous_messages",
                CLEAR_FOCUS_INDEX: {
                    actions: assign((_, _ev) => ({ focusIndex: undefined })),
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
                GO_TO_EVENT_INDEX: {
                    target: ".loading_previous_messages",
                    actions: assign((_, ev) => ({
                        focusIndex: ev.data,
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
                MESSAGE_READ_BY_ME: {
                    // we need to send this modified chat summary to the parent machine
                    // so that it can sync it with the chat poller - nasty
                    // we also need to seend it to the mark read machine to periodically ping off to the server
                    actions: pure((_ctx, ev) => {
                        return sendParent<ChatContext, ChatEvents>(ev);
                    }),
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
                                            chatStore.set({
                                                chatId: ctx.chatSummary.chatId,
                                                event: "loaded_previous_messages",
                                            });
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
                            entry: pure((ctx, _) => {
                                toastStore.showFailureToast(ctx.error?.stack ?? "error");
                                return undefined;
                            }),
                        },
                    },
                },
                showing_group: {
                    invoke: {
                        id: "editGroupMachine",
                        src: editGroupMachine,
                        data: (ctx, ev) => {
                            if (ctx.chatSummary.kind !== "group_chat") {
                                throw new Error("Cannot edit a direct chat");
                            }
                            return {
                                serviceContainer: ctx.serviceContainer,
                                chatSummary: ctx.chatSummary, // this is a blatant lie to the compiler but it doesn't seem to mind lol / sigh
                                updatedGroup: {
                                    name: ctx.chatSummary.name,
                                    desc: ctx.chatSummary.description,
                                },
                                history: [
                                    ev.type === "ADD_PARTICIPANT"
                                        ? "add_participants"
                                        : ev.type === "SHOW_PARTICIPANTS"
                                        ? "show_participants"
                                        : "group_details",
                                ],
                                user: ctx.user,
                                error: undefined,
                                usersToAdd: [],
                            };
                        },
                        onDone: {
                            target: "#ui_idle",
                            actions: assign((ctx, ev: DoneInvokeEvent<GroupChatSummary>) => {
                                if (ctx.chatSummary.kind === "group_chat" && ev.data) {
                                    return {
                                        chatSummary: ev.data,
                                    };
                                }
                                return {};
                            }),
                        },
                        onError: {
                            // todo - can this really *fail* or would we just deal with it in the sub machine?
                            target: "#ui_idle",
                        },
                    },
                },
                selecting_emojii: {},
            },
        },
    },
};

export const chatMachine = createMachine<ChatContext, ChatEvents>(schema, liveConfig);
export type ChatMachine = typeof chatMachine;
