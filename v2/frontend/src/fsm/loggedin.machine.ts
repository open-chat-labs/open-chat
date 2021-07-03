/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
    assign,
    createMachine,
    DoneInvokeEvent,
    MachineConfig,
    MachineOptions,
    sendParent,
} from "xstate";
import { inspect } from "@xstate/inspect";
import type { ServiceContainer } from "../services/serviceContainer";
import type { User } from "../domain/user";
import type { ChatSummary } from "../domain/chat";

if (typeof window !== "undefined") {
    inspect({
        iframe: false,
    });
}

export interface LoggedInContext {
    serviceContainer?: ServiceContainer;
    user?: User;
    chats: ChatSummary[];
    selectedChatId?: string;
    error?: Error;
}

export type LoggedInEvents =
    | { type: "LOAD_MESSAGES"; data: string }
    | { type: "CLEAR_SELECTED_CHAT" }
    | { type: "done.invoke.getChats"; data: ChatSummary[] }
    | { type: "error.platform.getChats"; data: Error };

const liveConfig: Partial<MachineOptions<LoggedInContext, LoggedInEvents>> = {
    guards: {
        selectedChatIsValid: (ctx, ev) => {
            if (ev.type === "LOAD_MESSAGES") {
                return ctx.chats.findIndex((c) => c.chatId === ev.data) >= 0;
            }
            return false;
        },
    },
    services: {
        getChats: (ctx, _) => ctx.serviceContainer!.getChats(),
        loadMessages: (_ctx, _) => new Promise((resolve) => setTimeout(resolve, 2000)),
    },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const schema: MachineConfig<LoggedInContext, any, LoggedInEvents> = {
    id: "logged_in_machine",
    initial: "loading_chats",
    context: {
        chats: [],
    },
    states: {
        loading_chats: {
            invoke: {
                id: "getChats",
                src: "getChats",
                onDone: [
                    {
                        target: "loaded_chats",
                        actions: assign({
                            chats: (_, ev: DoneInvokeEvent<ChatSummary[]>) => {
                                return ev.type === "done.invoke.getChats" ? ev.data : [];
                            },
                            error: (_, _ev) => undefined,
                        }),
                    },
                ],
                onError: {
                    target: "unexpected_error",
                    actions: assign({
                        error: (_, { data }) => data,
                    }),
                },
            },
        },
        loaded_chats: {
            initial: "idle",
            id: "loaded_chats",
            on: {
                LOAD_MESSAGES: {
                    // if we arrive at this outer handler it means we are not currently loading chats
                    // so we can immediately go off and try to load the messages
                    target: "loaded_chats.loading_messages",
                    cond: "selectedChatIsValid",
                },
                CLEAR_SELECTED_CHAT: {
                    actions: assign({
                        selectedChatId: (_ctx, _) => undefined,
                    }),
                },
            },
            states: {
                loading_messages: {
                    entry: assign({
                        selectedChatId: (ctx, ev) => {
                            if (ev.type === "LOAD_MESSAGES") {
                                return ctx.chats.find((c) => c.chatId === ev.data)?.chatId;
                            }
                            return undefined;
                        },
                    }),
                    invoke: {
                        id: "loadMessages",
                        src: "loadMessages",
                        onDone: [
                            {
                                target: "idle",
                            },
                        ],
                    },
                },
                idle: {},
            },
        },
        unexpected_error: {
            type: "final",
            entry: sendParent((ctx, _) => ({
                type: "error.platform.loggedInMachine",
                data: ctx.error,
            })),
        },
    },
};

export const loggedInMachine = createMachine<LoggedInContext, LoggedInEvents>(schema, liveConfig);
export type LoggedInMachine = typeof loggedInMachine;
