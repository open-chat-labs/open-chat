/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
    ActionObject,
    createMachine,
    DoneInvokeEvent,
    MachineConfig,
    MachineOptions,
} from "xstate";
import { assign, pure, send, sendParent } from "xstate/lib/actions";
import type {
    ChatSummary,
    EventsResponse,
    EventWrapper,
    EnhancedReplyContext,
    MessageContent,
    ChatEvent,
    ReplyContext,
    DirectChatReplyContext,
} from "../domain/chat/chat";
import {
    createGroupMessage,
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
    | { type: "SHOW_PARTICIPANTS" }
    | { type: "SEND_MESSAGE"; data?: string }
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
    earliestRequiredEventIndex: number,
    earliestLoadedEventIndex: number
): Promise<EventsResponse<ChatEvent>> {
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
    return ctx.chatSummary.kind === "group_chat" ? ctx.chatSummary.minVisibleEventIndex : 0;
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
                    actions: [
                        assign((ctx, ev) => {
                            chatStore.set({
                                chatId: ctx.chatSummary.chatId,
                                event: "sending_message",
                            });
                            const index = latestLoadedEventIndex(ctx.events) ?? 0;
                            if (ctx.chatSummary.kind === "group_chat") {
                                const msg = createGroupMessage(
                                    ctx.user!.userId,
                                    index + 1,
                                    ev.data,
                                    ctx.replyingTo,
                                    ctx.fileToAttach
                                );

                                // todo - this is fire and forget at the moment
                                // doesn't seem right - need to figure out what we do if it fails
                                // I think it might be simpler and indeed better to deal with this
                                // inside the relevant svelte component. That way on error we
                                // can simply fire another message into the state machine to have
                                // it remove the candidate message. I don't think we can safely
                                // modify context from this catch block as it stands
                                ctx.serviceContainer
                                    .sendGroupMessage(
                                        ctx.chatSummary.chatId,
                                        ctx.user!.username,
                                        msg
                                    )
                                    .catch((_err) =>
                                        toastStore.showFailureToast("errorSendingMessage")
                                    );
                                return {
                                    events: [
                                        ...ctx.events,
                                        {
                                            event: msg,
                                            index: index + 1,
                                            timestamp: BigInt(+new Date() - index + 1),
                                        },
                                    ],
                                    replyingTo: undefined,
                                    fileToAttach: undefined,
                                };
                            }
                            return {};
                        }),
                    ],
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
                    actions: pure((_, ev) => {
                        // a lot of hideous type hints required here for some reason
                        const actions: ActionObject<ChatContext, ChatEvents>[] = [
                            assign<ChatContext, ChatEvents>({
                                fileToAttach: ev.data,
                            }),
                        ];
                        if (ev.data.kind === "file_content") {
                            actions.push(send({ type: "SEND_MESSAGE" }));
                        }
                        return actions;
                    }),
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
