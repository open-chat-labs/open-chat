/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { createMachine, DoneInvokeEvent, MachineConfig, MachineOptions } from "xstate";
import { assign, escalate, log } from "xstate/lib/actions";
import type { ChatSummary, GetMessagesResponse, Message } from "../domain/chat/chat";
import { userIdsFromChatSummaries } from "../domain/chat/chat.utils";
import type { UserLookup, UserSummary } from "../domain/user/user";
import { mergeUsers, missingUserIds } from "../domain/user/user.utils";
import type { ServiceContainer } from "../services/serviceContainer";
import { userSearchMachine } from "./userSearch.machine";

const PAGE_SIZE = 20;

export interface ChatContext {
    serviceContainer: ServiceContainer;
    chatSummary: ChatSummary;
    userLookup: UserLookup;
    user?: UserSummary;
    error?: Error;
    messages: Message[];
    latestMessageIndex?: number;
    focusIndex?: number;
}

type LoadMessagesResponse = {
    userLookup: UserLookup;
    messages: Message[];
    latestMessageIndex: number;
};

export type ChatEvents =
    | { type: "done.invoke.loadMessagesAndUsers"; data: LoadMessagesResponse }
    | { type: "error.platform.loadMessagesAndUsers"; data: Error }
    | { type: "GO_TO_MESSAGE_INDEX"; data: number }
    | { type: "SHOW_PARTICIPANTS" }
    | { type: "CLEAR_FOCUS_INDEX" }
    | { type: "ADD_PARTICIPANT" }
    | { type: "LOAD_MORE_MESSAGES" }
    | { type: "CANCEL_ADD_PARTICIPANT" }
    | { type: "REMOVE_PARTICIPANT"; data: string }
    | { type: "DISMISS_AS_ADMIN"; data: string }
    | { type: "HIDE_PARTICIPANTS" }
    | { type: "done.invoke.removeParticipant"; data: LoadMessagesResponse }
    | { type: "error.platform.removeParticipant"; data: Error }
    | { type: "done.invoke.dismissAsAdmin"; data: LoadMessagesResponse }
    | { type: "error.platform.dismissAsAdmin"; data: Error }
    | { type: "done.invoke.userSearchMachine"; data: UserSummary }
    | { type: "error.platform.userSearchMachine"; data: Error };

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
): Promise<GetMessagesResponse> {
    if (chatSummary.kind === "direct_chat") {
        return serviceContainer.directChatMessages(
            chatSummary.them,
            earliestRequiredMessageIndex,
            earliestLoadedMessageIndex
        );
    }
    return serviceContainer.groupChatMessages(
        chatSummary.chatId,
        earliestRequiredMessageIndex,
        earliestLoadedMessageIndex
    );
}

export function earliestAvailableMessageIndex(ctx: ChatContext): number {
    return ctx.chatSummary.kind === "group_chat"
        ? 0 // todo - replace with a prop on the group chat summary type
        : 0;
}

export function earliestLoadedMessageIndex(ctx: ChatContext): number {
    return ctx.messages[0]?.messageIndex ?? ctx.chatSummary.latestMessageIndex;
}

export function moreMessagesAvailable(ctx: ChatContext): boolean {
    return earliestLoadedMessageIndex(ctx) > earliestAvailableMessageIndex(ctx);
}

const liveConfig: Partial<MachineOptions<ChatContext, ChatEvents>> = {
    guards: {
        moreMessagesAvailable,
    },
    services: {
        loadMessagesAndUsers: async (ctx, ev) => {
            const earliestLoaded = earliestLoadedMessageIndex(ctx);
            const earliestRequired =
                ev.type === "GO_TO_MESSAGE_INDEX"
                    ? ev.data - PAGE_SIZE
                    : earliestLoaded - PAGE_SIZE;

            // we may not actually *need* to look up any messages
            const lookupRequired = earliestRequired < earliestLoaded && moreMessagesAvailable(ctx);

            const [userLookup, messagesResponse] = await Promise.all([
                loadUsersForChat(ctx.serviceContainer, ctx.userLookup, ctx.chatSummary),
                lookupRequired
                    ? loadMessages(
                          ctx.serviceContainer!,
                          ctx.chatSummary,
                          earliestRequired,
                          earliestLoaded
                      )
                    : { messages: [], latestMessageIndex: 0 },
            ]);
            return {
                userLookup,
                messages: messagesResponse === "chat_not_found" ? [] : messagesResponse.messages,
                latestMessageIndex:
                    messagesResponse === "chat_not_found"
                        ? ctx.chatSummary.latestMessageIndex
                        : messagesResponse.latestMessageIndex,
            };
        },
        removeParticipant: (_ctx, _ev) => {
            // todo - what do we do if this fails given that we have already optimistically removed it?
            // perhaps we have to keep track of the participant that we are trying to delete so that we can
            // re-insert if it fails
            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    resolve();
                }, 1000);
            });
        },
        dismissAsAdmin: (_ctx, _ev) => {
            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    resolve();
                }, 1000);
            });
        },
    },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const schema: MachineConfig<ChatContext, any, ChatEvents> = {
    id: "chat_machine",
    initial: "loading_messages",
    states: {
        idle: {
            entry: log("entering the chat machine"),
        },
        loading_messages: {
            invoke: {
                id: "loadMessagesAndUsers",
                src: "loadMessagesAndUsers",
                onDone: {
                    target: "loaded_messages",
                    actions: assign((ctx, ev: DoneInvokeEvent<LoadMessagesResponse>) => {
                        return {
                            userLookup: ev.data.userLookup,
                            messages: [...ev.data.messages, ...ctx.messages],
                            latestMessageIndex: ev.data.latestMessageIndex,
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
        showing_participants: {
            entry: log("entering showing_particitants"),
            initial: "idle",
            on: {
                HIDE_PARTICIPANTS: "loaded_messages",
                REMOVE_PARTICIPANT: ".removing_participant",
                DISMISS_AS_ADMIN: ".dismissing_participant",
                ADD_PARTICIPANT: ".adding_participant",
            },
            states: {
                idle: {},
                adding_participant: {
                    on: {
                        CANCEL_ADD_PARTICIPANT: "idle",
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
                            target: "idle",
                            actions: assign((ctx, ev: DoneInvokeEvent<UserSummary>) => {
                                if (ctx.chatSummary.kind === "group_chat" && ev.data) {
                                    // todo - we will need to make some subsequent call to actually add the user to the group properly
                                    console.log("selected user from search machine: ", ev.data);
                                    return {
                                        userLookup: {
                                            ...ctx.userLookup,
                                            [ev.data.userId]: ev.data,
                                        },
                                        chatSummary: {
                                            ...ctx.chatSummary,
                                            participants: [
                                                ev.data.userId,
                                                ...ctx.chatSummary.participants,
                                            ],
                                        },
                                    };
                                }
                                return {};
                            }),
                        },
                        onError: {
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
                dismissing_participant: {
                    invoke: {
                        id: "dismissAsAdmin",
                        src: "dismissAsAdmin",
                        onDone: {
                            target: "idle",
                        },
                        onError: {
                            target: "..unexpected_error",
                            actions: assign({
                                error: (_, { data }) => data,
                            }),
                        },
                    },
                },
                removing_participant: {
                    entry: assign((ctx, ev) => {
                        if (
                            ctx.chatSummary.kind === "group_chat" &&
                            ev.type === "REMOVE_PARTICIPANT"
                        ) {
                            return {
                                chatSummary: {
                                    ...ctx.chatSummary,
                                    participants: ctx.chatSummary.participants.filter(
                                        (p) => p !== ev.data
                                    ),
                                },
                            };
                        }
                        return {};
                    }),
                    invoke: {
                        id: "removeParticipant",
                        src: "removeParticipant",
                        onDone: {
                            target: "idle",
                        },
                        onError: {
                            // todo - need to make sure that this actually works - I'm not sure it does
                            actions: escalate((_, { data }) => data),
                        },
                    },
                },
            },
        },
        loaded_messages: {
            on: {
                SHOW_PARTICIPANTS: "showing_participants",
                ADD_PARTICIPANT: "showing_participants.adding_participant",
                LOAD_MORE_MESSAGES: "loading_messages",
                CLEAR_FOCUS_INDEX: {
                    actions: assign((_, ev) => ({ focusIndex: undefined })),
                },
                GO_TO_MESSAGE_INDEX: {
                    target: "loading_messages",
                    actions: assign((_, ev) => {
                        return {
                            focusIndex: ev.data,
                        };
                    }),
                },
            },
        },
        unexpected_error: {
            // todo - not sure what we do when we end up here?
            // log the error I suppose at least
            // error handling in general needs a bit of thought.
            // It doesn't feel quite right at the moment.
            // should be anything unexpected bubbles all the way to the top
            // and we see the generic error UI.
            // currently we will only see the generic UI if the identity machine is in the unexpected_error state
            // I don't think errors will bubble like that. We need to handle them a lot more carefully.
        },
    },
};

export const chatMachine = createMachine<ChatContext, ChatEvents>(schema, liveConfig);
export type ChatMachine = typeof chatMachine;
