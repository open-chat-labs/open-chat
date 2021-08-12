/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { createMachine, MachineConfig, MachineOptions } from "xstate";
import { assign, pure, sendParent } from "xstate/lib/actions";
import type {
    ChatSummary,
    EventsResponse,
    EventWrapper,
    EnhancedReplyContext,
} from "../domain/chat/chat";
import {
    earliestLoadedEventIndex,
    latestAvailableEventIndex,
    latestLoadedEventIndex,
    textMessage,
    userIdsFromChatSummaries,
} from "../domain/chat/chat.utils";
import type { UserLookup, UserSummary } from "../domain/user/user";
import { mergeUsers, missingUserIds } from "../domain/user/user.utils";
import type { ServiceContainer } from "../services/serviceContainer";
import { participantsMachine } from "./participants.machine";
import { toastStore } from "../stores/toast";
import { dedupe } from "../utils/list";

const PAGE_SIZE = 20;

export interface ChatContext {
    serviceContainer: ServiceContainer;
    chatSummary: ChatSummary;
    userLookup: UserLookup;
    user?: UserSummary;
    error?: Error;
    events: EventWrapper[];
    focusIndex?: number; // this is the index of a message that we want to scroll to
    replyingTo?: EnhancedReplyContext;
}

type LoadEventsResponse = {
    userLookup: UserLookup;
    events: EventWrapper[];
};

export type ChatEvents =
    | { type: "done.invoke.loadEventsAndUsers"; data: LoadEventsResponse }
    | { type: "error.platform.loadEventsAndUsers"; data: Error }
    | { type: "GO_TO_MESSAGE_INDEX"; data: number }
    | { type: "SHOW_PARTICIPANTS" }
    | { type: "SEND_MESSAGE"; data: string }
    | { type: "CLEAR_FOCUS_INDEX" }
    | { type: "REPLY_TO"; data: EnhancedReplyContext }
    | { type: "REPLY_PRIVATELY_TO"; data: EnhancedReplyContext }
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
    earliestRequiredEventIndex: number,
    earliestLoadedEventIndex: number
): Promise<EventsResponse> {
    if (chatSummary.kind === "direct_chat") {
        return serviceContainer.directChatEvents(
            chatSummary.them,
            earliestRequiredEventIndex,
            earliestLoadedEventIndex
        );
    }
    const events = serviceContainer.groupChatEvents(
        chatSummary.chatId,
        earliestRequiredEventIndex,
        earliestLoadedEventIndex
    );
    return events;
}

export function moreMessagesAvailable(ctx: ChatContext): boolean {
    return earliestIndex(ctx) >= earliestAvailableMessageIndex(ctx);
}

export function earliestAvailableMessageIndex(ctx: ChatContext): number {
    return ctx.chatSummary.kind === "group_chat" ? ctx.chatSummary.minVisibleMessageIndex : 0;
}

export function earliestIndex(ctx: ChatContext): number {
    const earliestLoaded = earliestLoadedEventIndex(ctx.events);
    if (earliestLoaded) {
        return earliestLoaded - 1;
    } else {
        return ctx.chatSummary.latestEventIndex;
    }
}

export function newMessagesRange(ctx: ChatContext): [number, number] | undefined {
    const lastLoaded = latestLoadedEventIndex(ctx.events);
    if (lastLoaded) {
        const from = lastLoaded + 1;
        const to = latestAvailableEventIndex(ctx.chatSummary) ?? 0;
        return clampRange([from, to]);
    } else {
        // this implies that we have not loaded any messages which should never happen
        return undefined;
    }
}

export function previousMessagesRange(ctx: ChatContext): [number, number] | undefined {
    const to = earliestIndex(ctx);
    const candidateFrom =
        ctx.focusIndex !== undefined ? ctx.focusIndex - PAGE_SIZE : to - PAGE_SIZE;
    const min = earliestAvailableMessageIndex(ctx);
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
                events:
                    eventsResponse === "chat_not_found" || eventsResponse === "not_authorised"
                        ? []
                        : eventsResponse.events,
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
                            actions: "assignEventsResponse",
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
                SEND_MESSAGE: ".sending_message",
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
                    actions: assign((_, ev) => {
                        return {
                            focusIndex: ev.data,
                        };
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
                                    actions: "assignEventsResponse",
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
                sending_message: {
                    entry: assign((ctx, ev) => {
                        if (ev.type === "SEND_MESSAGE") {
                            // todo - this is obvious a huge simplification at the moment
                            const index = latestLoadedEventIndex(ctx.events) ?? 0;
                            return {
                                events: [
                                    ...ctx.events,
                                    {
                                        event: textMessage(
                                            ctx.user!.userId,
                                            ev.data,
                                            ctx.replyingTo
                                        ),
                                        index: index + 1,
                                        timestamp: BigInt(+new Date() - index + 1),
                                    },
                                ],
                                replyingTo: undefined,
                            };
                        }
                        return {};
                    }),
                    after: {
                        // simulate the actual api call delay
                        // todo - this will cause us to skip messages that are entered if they are < 2000 ms since the last
                        // one. Don't worry about that for now.
                        // although - not sure *why*
                        100: "idle",
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
