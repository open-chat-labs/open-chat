/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { createMachine, DoneInvokeEvent, MachineConfig, MachineOptions } from "xstate";
import { assign, log } from "xstate/lib/actions";
import type { ChatSummary } from "../domain/chat/chat";
import { userIdsFromChatSummaries } from "../domain/chat/chat.utils";
import type { UserLookup } from "../domain/user/user";
import { mergeUsers, missingUserIds } from "../domain/user/user.utils";
import type { ServiceContainer } from "../services/serviceContainer";

export interface ChatContext {
    serviceContainer: ServiceContainer;
    chatSummary: ChatSummary;
    userLookup: UserLookup;
    error?: Error;
}

type LoadMessagesResponse = { userLookup: UserLookup; messages: unknown[] };

export type ChatEvents =
    | { type: "done.invoke.loadMessages"; data: LoadMessagesResponse }
    | { type: "error.platform.loadMessages"; data: Error }
    | { type: "SHOW_PARTICIPANTS" }
    | { type: "REMOVE_PARTICIPANT"; data: string }
    | { type: "HIDE_PARTICIPANTS" }
    | { type: "done.invoke.removeParticipant"; data: LoadMessagesResponse }
    | { type: "error.platform.removeParticipant"; data: Error };

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
            on: {
                HIDE_PARTICIPANTS: "loaded_messages",
                REMOVE_PARTICIPANT: "removing_participant",
            },
        },
        removing_participant: {
            entry: assign((ctx, ev) => {
                if (ctx.chatSummary.kind === "group_chat" && ev.type === "REMOVE_PARTICIPANT") {
                    return {
                        chatSummary: {
                            ...ctx.chatSummary,
                            participants: ctx.chatSummary.participants.filter((p) => p !== ev.data),
                        },
                    };
                }
                return {};
            }),
            invoke: {
                id: "removeParticipant",
                src: "removeParticipant",
                onDone: {
                    target: "showing_participants",
                },
                onError: {
                    target: "unexpected_error",
                    actions: assign({
                        error: (_, { data }) => data,
                    }),
                },
            },
        },
        loaded_messages: {
            on: {
                SHOW_PARTICIPANTS: "showing_participants",
            },
        },
        unexpected_error: {
            // todo - not sure what we do when we end up here?
            // log the error I suppose at least
        },
    },
};

export const chatMachine = createMachine<ChatContext, ChatEvents>(schema, liveConfig);
export type ChatMachine = typeof chatMachine;
