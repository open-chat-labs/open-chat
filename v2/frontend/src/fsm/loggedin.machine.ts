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
import { push } from "svelte-spa-router";
import { log } from "xstate/lib/actions";

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
    | { type: "SET_SELECTED_CHAT_ID"; data: string }
    | { type: "done.invoke.getChats"; data: ChatSummary[] }
    | { type: "error.platform.getChats"; data: Error };

const liveConfig: Partial<MachineOptions<LoggedInContext, LoggedInEvents>> = {
    guards: {
        atLeastOneChat: (ctx, ev) => {
            if (ev.type === "done.invoke.getChats") {
                return ev.data.length > 0;
            }
            return ctx.chats.length > 0;
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
    on: {
        SET_SELECTED_CHAT_ID: {
            // if we arrive at this outer handler it means we are not currently loading chats
            // so we can immediately go off and try to load the messages
            target: "loading_messages",
            cond: "atLeastOneChat",
            actions: assign({
                selectedChatId: (ctx, ev) => {
                    console.log("setting chat id from click");
                    if (ev.type === "SET_SELECTED_CHAT_ID") {
                        return ctx.chats.find((c) => c.chatId === ev.data)?.chatId;
                    }
                    return undefined;
                },
            }),
        },
    },
    states: {
        loading_chats: {
            on: {
                // we define this inside the loading state so that we can handle it slightly differently
                SET_SELECTED_CHAT_ID: {
                    actions: assign({
                        selectedChatId: (_, ev) => {
                            // because we are in the middle of loading chats we will just record the
                            // selected chat id
                            return ev.type === "SET_SELECTED_CHAT_ID" ? ev.data : undefined;
                        },
                    }),
                },
            },
            invoke: {
                id: "getChats",
                src: "getChats",
                onDone: [
                    {
                        target: "loading_messages",
                        cond: "atLeastOneChat",
                        actions: assign({
                            chats: (_, ev: DoneInvokeEvent<ChatSummary[]>) => {
                                return ev.type === "done.invoke.getChats" ? ev.data : [];
                            },
                            error: (_, _ev) => undefined,
                        }),
                    },
                    {
                        target: "idle",
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
        idle: {},
        loading_messages: {
            entry: log("entering loading_messages"),
            invoke: {
                id: "loadMessages",
                src: "loadMessages",
                onDone: [
                    {
                        target: "idle",
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
