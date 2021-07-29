/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { createMachine, MachineConfig, MachineOptions } from "xstate";
import { assign, pure } from "xstate/lib/actions";
import type { ChatSummary, MessagesResponse, Message } from "../domain/chat/chat";
import {
    earliestLoadedMessageIndex,
    latestAvailableMessageIndex,
    latestLoadedMessageIndex,
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
    messages: Message[];
    focusIndex?: number; // this is the index of a message that we want to scroll to
}

type LoadMessagesResponse = {
    userLookup: UserLookup;
    messages: Message[];
};

export type ChatEvents =
    | { type: "done.invoke.loadMessagesAndUsers"; data: LoadMessagesResponse }
    | { type: "error.platform.loadMessagesAndUsers"; data: Error }
    | { type: "GO_TO_MESSAGE_INDEX"; data: number }
    | { type: "SHOW_PARTICIPANTS" }
    | { type: "SEND_MESSAGE"; data: string }
    | { type: "CLEAR_FOCUS_INDEX" }
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

function loadMessages(
    serviceContainer: ServiceContainer,
    chatSummary: ChatSummary,
    earliestRequiredMessageIndex: number,
    earliestLoadedMessageIndex: number
): Promise<MessagesResponse> {
    if (chatSummary.kind === "direct_chat") {
        return serviceContainer.directChatMessages(
            chatSummary.them,
            earliestRequiredMessageIndex,
            earliestLoadedMessageIndex
        );
    }
    const messages = serviceContainer.groupChatMessages(
        chatSummary.chatId,
        earliestRequiredMessageIndex,
        earliestLoadedMessageIndex
    );
    return messages;
}

export function moreMessagesAvailable(ctx: ChatContext): boolean {
    return earliestIndex(ctx) >= earliestAvailableMessageIndex(ctx);
}

export function earliestAvailableMessageIndex(ctx: ChatContext): number {
    return ctx.chatSummary.kind === "group_chat" ? ctx.chatSummary.minVisibleMessageIndex : 0;
}

export function earliestIndex(ctx: ChatContext): number {
    const earliestLoaded = earliestLoadedMessageIndex(ctx.messages);
    if (earliestLoaded) {
        return earliestLoaded - 1;
    } else {
        return ctx.chatSummary.latestMessage?.messageIndex ?? 0;
    }
}

export function newMessagesRange(ctx: ChatContext): [number, number] | undefined {
    const lastLoaded = latestLoadedMessageIndex(ctx.messages);
    if (lastLoaded) {
        const from = lastLoaded + 1;
        const to = latestAvailableMessageIndex(ctx.chatSummary) ?? 0;
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
        loadMessagesAndUsers: async (ctx, ev) => {
            const range = requiredMessageRange(ctx, ev);

            const [userLookup, messagesResponse] = await Promise.all([
                loadUsersForChat(ctx.serviceContainer, ctx.userLookup, ctx.chatSummary),
                range
                    ? loadMessages(ctx.serviceContainer!, ctx.chatSummary, range[0], range[1])
                    : { messages: [] },
            ]);
            return {
                userLookup,
                messages: messagesResponse === "chat_not_found" ? [] : messagesResponse.messages,
            };
        },
    },
    actions: {
        assignMessagesResponse: assign((ctx, ev) =>
            // todo - we should de-dupe here. It is always possible that we could load the same
            // message twice
            ev.type === "done.invoke.loadMessagesAndUsers"
                ? {
                      userLookup: ev.data.userLookup,
                      messages: dedupe(
                          (a, b) => a.messageIndex === b.messageIndex,
                          [...ev.data.messages, ...ctx.messages].sort(
                              (a, b) => a.messageIndex - b.messageIndex
                          )
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
                // todo - this is not quite right at the moment as it will load all new messages
                // for a chat regardless of whether the chat is selected or not.
                // we should probably only do that if this is the active (selected chat)
                CHAT_UPDATED: {
                    target: ".loading",
                    internal: true,
                    actions: assign((_, ev) => {
                        return {
                            chatSummary: ev.data,
                            latestMessageIndex: ev.data.latestMessage?.messageIndex ?? 0,
                        };
                    }),
                },
            },
            states: {
                idle: {},
                loading: {
                    invoke: {
                        id: "loadMessagesAndUsers",
                        src: "loadMessagesAndUsers",
                        onDone: {
                            target: "idle",
                            actions: "assignMessagesResponse",
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
                                id: "loadMessagesAndUsers",
                                src: "loadMessagesAndUsers",
                                onDone: {
                                    target: "#ui_idle",
                                    actions: "assignMessagesResponse",
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
                            const messageIndex = latestLoadedMessageIndex(ctx.messages) ?? 0;
                            return {
                                messages: [
                                    ...ctx.messages,
                                    {
                                        ...textMessage(ctx.user!.userId, ev.data),
                                        messageIndex: messageIndex + 1,
                                        timestamp: BigInt(+new Date() - messageIndex + 1),
                                    },
                                ],
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
