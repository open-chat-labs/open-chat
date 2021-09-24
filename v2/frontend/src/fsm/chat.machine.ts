/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
    ActorRefFrom,
    createMachine,
    DoneInvokeEvent,
    MachineConfig,
    MachineOptions,
} from "xstate";
import { assign, pure, sendParent } from "xstate/lib/actions";
import type {
    ChatSummary,
    EventsResponse,
    EventWrapper,
    EnhancedReplyContext,
    MessageContent,
    ChatEvent,
    ReplyContext,
    SendMessageSuccess,
    GroupChatSummary,
    Message,
} from "../domain/chat/chat";
import {
    earliestLoadedEventIndex,
    indexRangeForChat,
    latestLoadedEventIndex,
    setLastMessageOnChat,
    toggleGroupReaction,
    userIdsFromChatSummaries,
} from "../domain/chat/chat.utils";
import type { UserLookup, UserSummary } from "../domain/user/user";
import { mergeUsers, missingUserIds } from "../domain/user/user.utils";
import type { ServiceContainer } from "../services/serviceContainer";
import { editGroupMachine } from "./editgroup.machine";
import { toastStore } from "../stores/toast";
import { dedupe } from "../utils/list";
import { chatStore } from "../stores/chat";
import type { MarkReadMachine } from "./markread.machine";

export interface ChatContext {
    serviceContainer: ServiceContainer;
    chatSummary: ChatSummary;
    userLookup: UserLookup;
    user?: UserSummary;
    error?: Error;
    events: EventWrapper<ChatEvent>[];
    focusIndex?: number; // this is the index of a message that we want to scroll to
    replyingTo?: EnhancedReplyContext<ReplyContext>;
    fileToAttach?: MessageContent;
    markMessages: ActorRefFrom<MarkReadMachine>;
}

type LoadEventsResponse = {
    userLookup: UserLookup;
    events: EventWrapper<ChatEvent>[];
};

export type ChatEvents =
    | {
          type: "done.invoke.loadEventsAndUsers";
          data: LoadEventsResponse;
      }
    | { type: "error.platform.loadEventsAndUsers"; data: Error }
    | { type: "error.platform.sendMessage"; data: Error }
    | { type: "GO_TO_EVENT_INDEX"; data: number }
    | { type: "MESSAGE_READ_BY_ME"; data: { chatId: string; messageIndex: number } }
    | { type: "SHOW_GROUP_DETAILS" }
    | { type: "SHOW_PARTICIPANTS" }
    | { type: "SEND_MESSAGE"; data: EventWrapper<Message> }
    | { type: "TOGGLE_REACTION"; data: { message: Message; reaction: string } }
    | { type: "REMOVE_MESSAGE"; data: Message }
    | {
          type: "UPDATE_MESSAGE";
          data: { candidate: Message; resp: SendMessageSuccess };
      }
    | { type: "ATTACH_FILE"; data: MessageContent }
    | { type: "CLEAR_ATTACHMENT" }
    | { type: "CLEAR_FOCUS_INDEX" }
    | {
          type: "REPLY_TO";
          data: EnhancedReplyContext<ReplyContext>;
      }
    | {
          type: "REPLY_PRIVATELY_TO";
          data: EnhancedReplyContext<ReplyContext>;
      }
    | { type: "CANCEL_REPLY_TO" }
    | { type: "ADD_PARTICIPANT" }
    | { type: "CHAT_UPDATED"; data: ChatSummary }
    | { type: "LOAD_PREVIOUS_MESSAGES" };

async function loadUsersForChat(
    serviceContainer: ServiceContainer,
    userLookup: UserLookup,
    chatSummary: ChatSummary
): Promise<UserLookup> {
    if (chatSummary.kind === "group_chat") {
        const userIds = userIdsFromChatSummaries([chatSummary], true);
        const { users } = await serviceContainer.getUsers(
            missingUserIds(userLookup, userIds),
            BigInt(0) // timestamp irrelevant for missing users
        );
        return mergeUsers(userLookup, users);
    }
    return Promise.resolve(userLookup);
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
    console.log("criteria: ", startIndex, ascending);
    const events = serviceContainer
        .groupChatEvents(indexRangeForChat(chatSummary), chatSummary.chatId, startIndex, ascending)
        .then((resp) => {
            console.log(resp);
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
    const lastLoaded = latestLoadedEventIndex(ctx.events);
    console.log("chat_updated: ", lastLoaded, ctx.chatSummary.latestEventIndex);
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
    return [highestUnloadedEventIndex(ctx), false];
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

            const [userLookup, eventsResponse] = await Promise.all([
                loadUsersForChat(ctx.serviceContainer, ctx.userLookup, ctx.chatSummary),
                criteria
                    ? loadEvents(ctx.serviceContainer!, ctx.chatSummary, criteria[0], criteria[1])
                    : { events: [] },
            ]);
            return {
                userLookup,
                events: eventsResponse === "chat_not_found" ? [] : eventsResponse.events,
            };
        },
    },
    actions: {
        assignEventsResponse: assign((ctx, ev) =>
            ev.type === "done.invoke.loadEventsAndUsers"
                ? {
                      userLookup: ev.data.userLookup,
                      events: dedupe(
                          (a, b) => a.index === b.index,
                          [...ev.data.events, ...ctx.events].sort((a, b) => a.index - b.index)
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
                                    if (ev.data.events.length > 0) {
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
                SEND_MESSAGE: {
                    actions: assign((ctx, ev) => ({
                        chatSummary: setLastMessageOnChat(ctx.chatSummary, ev.data),
                        events: [...ctx.events, ev.data],
                        replyingTo: undefined,
                        fileToAttach: undefined,
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
                TOGGLE_REACTION: {
                    actions: assign((ctx, ev) => ({
                        events: ctx.events.map((e) => {
                            if (
                                e.event.kind === "message" &&
                                ev.data.message.kind === "message" &&
                                e.event.messageId === ev.data.message.messageId
                            ) {
                                return {
                                    ...e,
                                    event: {
                                        ...e.event,
                                        reactions: toggleGroupReaction(
                                            ctx.user!.userId,
                                            e.event.reactions,
                                            ev.data.reaction
                                        ),
                                    },
                                };
                            }
                            return e;
                        }),
                    })),
                },
                REMOVE_MESSAGE: {
                    actions: assign((ctx, ev) => ({
                        events: ctx.events.filter((e) => e.event !== ev.data),
                    })),
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
                    actions: pure((ctx, ev) => {
                        ctx.markMessages.send({
                            type: "MESSAGE_READ_BY_ME",
                            data: ev.data.messageIndex,
                        });
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
                                userLookup: ctx.userLookup,
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
