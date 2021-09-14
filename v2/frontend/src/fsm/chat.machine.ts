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
    DirectChatReplyContext,
    DirectMessage,
    GroupMessage,
    SendMessageSuccess,
} from "../domain/chat/chat";
import {
    earliestLoadedEventIndex,
    latestAvailableEventIndex,
    latestLoadedEventIndex,
    userIdsFromChatSummaries,
} from "../domain/chat/chat.utils";
import type { UserLookup, UserSummary } from "../domain/user/user";
import { mergeUsers, missingUserIds } from "../domain/user/user.utils";
import type { ServiceContainer } from "../services/serviceContainer";
import { participantsMachine } from "./participants.machine";
import { toastStore } from "../stores/toast";
import { dedupe } from "../utils/list";
import { chatStore } from "../stores/chat";
import type { MarkReadMachine } from "./markread.machine";

const PAGE_SIZE = 20;

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
    | { type: "GO_TO_MESSAGE_INDEX"; data: number }
    | { type: "MESSAGE_READ_BY_ME"; data: { chatId: string; messageIndex: number } }
    | { type: "SHOW_PARTICIPANTS" }
    | { type: "SEND_MESSAGE"; data: { message: GroupMessage | DirectMessage; index: number } }
    | { type: "REMOVE_MESSAGE"; data: GroupMessage | DirectMessage }
    | {
          type: "UPDATE_MESSAGE";
          data: { candidate: GroupMessage | DirectMessage; resp: SendMessageSuccess };
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
          data: EnhancedReplyContext<DirectChatReplyContext>;
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
    fromIndex: number,
    toIndex: number
): Promise<EventsResponse<ChatEvent>> {
    if (chatSummary.kind === "direct_chat") {
        return serviceContainer.directChatEvents(chatSummary.them, fromIndex, toIndex);
    }
    const events = serviceContainer.groupChatEvents(chatSummary.chatId, fromIndex, toIndex);
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

export function newMessagesRange(ctx: ChatContext): [number, number] | undefined {
    const lastLoaded = latestLoadedEventIndex(ctx.events);
    if (lastLoaded !== undefined) {
        const from = lastLoaded + 1;
        const to = latestAvailableEventIndex(ctx.chatSummary) ?? 0;
        return clampRange([from, to]);
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
 */
export function previousMessagesRange(ctx: ChatContext): [number, number] | undefined {
    const to = highestUnloadedEventIndex(ctx);
    const candidateFrom =
        ctx.focusIndex !== undefined ? ctx.focusIndex - PAGE_SIZE : to - PAGE_SIZE;
    const min = earliestAvailableEventIndex(ctx);
    const from = Math.max(min, candidateFrom);
    return clampRange([from, to]);
}

export function clampRange([from, to]: [number, number]): [number, number] | undefined {
    if (from > to) {
        return undefined;
    } else {
        return [from, to];
    }
}

export function requiredMessageRange(
    ctx: ChatContext,
    ev: ChatEvents
): [number, number] | undefined {
    if (ev.type === "CHAT_UPDATED") {
        return newMessagesRange(ctx);
    } else {
        return previousMessagesRange(ctx);
    }
}

const liveConfig: Partial<MachineOptions<ChatContext, ChatEvents>> = {
    guards: {},
    services: {
        loadEventsAndUsers: async (ctx, ev) => {
            const range = requiredMessageRange(ctx, ev);

            const [userLookup, eventsResponse] = await Promise.all([
                loadUsersForChat(ctx.serviceContainer, ctx.userLookup, ctx.chatSummary),
                range
                    ? loadEvents(ctx.serviceContainer!, ctx.chatSummary, range[0], range[1])
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
                        events: [
                            ...ctx.events,
                            {
                                event: ev.data.message,
                                index: ev.data.index,
                                timestamp: BigInt(+new Date()),
                            },
                        ],
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
                REMOVE_MESSAGE: {
                    actions: assign((ctx, ev) => ({
                        events: ctx.events.filter((e) => e.event !== ev.data),
                    })),
                },
                SHOW_PARTICIPANTS: ".showing_participants",
                ADD_PARTICIPANT: ".showing_participants",
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
                GO_TO_MESSAGE_INDEX: {
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
                                        pure((ctx, ev: DoneInvokeEvent<LoadEventsResponse>) => {
                                            if (ev.data.events.length > 0) {
                                                chatStore.set({
                                                    chatId: ctx.chatSummary.chatId,
                                                    event: "loaded_previous_messages",
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
                            entry: pure((ctx, _) => {
                                toastStore.showFailureToast(ctx.error?.stack ?? "error");
                                return undefined;
                            }),
                        },
                    },
                },
                showing_participants: {
                    invoke: {
                        id: "participantsMachine",
                        src: participantsMachine,
                        data: (ctx, ev) => {
                            return {
                                serviceContainer: ctx.serviceContainer,
                                chatSummary: ctx.chatSummary, // this is a blatant lie to the compiler but it doesn't seem to mind lol / sigh
                                userLookup: ctx.userLookup,
                                add: ev.type === "ADD_PARTICIPANT",
                                user: ctx.user,
                                error: undefined,
                                usersToAdd: [],
                            };
                        },
                        onDone: {
                            // todo - do we need to pass back the updated chat summary and merge it maybe?
                            target: "#ui_idle",
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
