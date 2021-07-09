/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { createMachine, DoneInvokeEvent, MachineConfig, MachineOptions } from "xstate";
import { assign, log } from "xstate/lib/actions";
import type { ChatSummary } from "../domain/chat/chat";
import type { UserLookup } from "../domain/user/user";
import type { ServiceContainer } from "../services/serviceContainer";

export interface ChatContext {
    serviceContainer: ServiceContainer;
    chatSummary: ChatSummary;
    userLookup: UserLookup;
    error?: Error;
}

type LoadMessagesResponse = { userLookup: UserLookup };

export type ChatEvents =
    | { type: "done.invoke.loadMessages"; data: LoadMessagesResponse }
    | { type: "error.platform.loadMessages"; data: Error };

const liveConfig: Partial<MachineOptions<ChatContext, ChatEvents>> = {
    guards: {},
    services: {
        loadMessages: async (ctx, _) => {
            // if (ctx.chatSummary.kind === "group_chat") {
            //     const userIds = userIdsFromChatSummaries([ctx.chatSummary], true);
            //     const { users } = await ctx.serviceContainer.getUsers(
            //         missingUserIds(ctx.userLookup, userIds),
            //         BigInt(0) // timestamp irrelevant for missing users
            //     );
            //     return {
            //         userLookup: mergeUsers(ctx.userLookup, users),
            //     };
            // }
            await new Promise((resolve) => {
                setTimeout(() => {
                    resolve({
                        userLookup: ctx.userLookup,
                    });
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
                id: "loadMessages",
                src: "loadMessages",
                onDone: {
                    target: "loaded_messages",
                    actions: assign((ctx, ev: DoneInvokeEvent<LoadMessagesResponse>) => {
                        console.log("finished loading messages", ctx.chatSummary.chatId);
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
        loaded_messages: {},
        unexpected_error: {},
    },
};

export const chatMachine = createMachine<ChatContext, ChatEvents>(schema, liveConfig);
export type ChatMachine = typeof chatMachine;
