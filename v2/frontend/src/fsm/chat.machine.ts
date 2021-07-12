/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { createMachine, DoneInvokeEvent, MachineConfig, MachineOptions } from "xstate";
import { assign, escalate, log } from "xstate/lib/actions";
import type { ChatSummary } from "../domain/chat/chat";
import { userIdsFromChatSummaries } from "../domain/chat/chat.utils";
import type { UserLookup, UserSummary } from "../domain/user/user";
import { mergeUsers, missingUserIds } from "../domain/user/user.utils";
import type { ServiceContainer } from "../services/serviceContainer";
import { userSearchMachine } from "./userSearch.machine";

export interface ChatContext {
    serviceContainer: ServiceContainer;
    chatSummary: ChatSummary;
    userLookup: UserLookup;
    user?: UserSummary;
    error?: Error;
}

type LoadMessagesResponse = { userLookup: UserLookup; messages: unknown[] };

export type ChatEvents =
    | { type: "done.invoke.loadMessages"; data: LoadMessagesResponse }
    | { type: "error.platform.loadMessages"; data: Error }
    | { type: "SHOW_PARTICIPANTS" }
    | { type: "ADD_PARTICIPANT" }
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

function loadMessages(): Promise<unknown[]> {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve([]);
        }, 1000);
    });
}

const liveConfig: Partial<MachineOptions<ChatContext, ChatEvents>> = {
    guards: {},
    services: {
        loadMessagesAndUsers: async (ctx, _) => {
            const [userLookup, messages] = await Promise.all([
                loadUsersForChat(ctx.serviceContainer, ctx.userLookup, ctx.chatSummary),
                loadMessages(),
            ]);
            return {
                userLookup,
                messages,
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
                    actions: assign((_ctx, ev: DoneInvokeEvent<LoadMessagesResponse>) => {
                        console.log("finished loading messages", ev.data);
                        return ev.data;
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
            on: {
                HIDE_PARTICIPANTS: "loaded_messages",
                REMOVE_PARTICIPANT: ".removing_participant",
                DISMISS_AS_ADMIN: ".dismissing_participant",
                ADD_PARTICIPANT: ".adding_participant",
            },
            states: {
                idle: {},
                adding_participant: {
                    initial: "in_progress",
                    on: {
                        CANCEL_ADD_PARTICIPANT: "idle",
                        "error.platform.userSearchMachine": "..unexpected_error",
                    },
                    states: {
                        in_progress: {},
                        unexpected_error: {
                            entry: log("in the error state"),
                        },
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
                            target: ".unexpected_error",
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
                            target: "..unexpected_error",
                            actions: assign({
                                error: (_, { data }) => data,
                            }),
                        },
                    },
                },
            },
        },
        loaded_messages: {
            on: {
                SHOW_PARTICIPANTS: "showing_participants",
                ADD_PARTICIPANT: "showing_participants.adding_participant",
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
