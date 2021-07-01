/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { assign, createMachine, MachineConfig, MachineOptions, sendParent } from "xstate";
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
    chats: unknown[];
    error?: Error;
}

export type LoggedInEvents =
    | { type: "done.invoke.getChats"; data: ChatSummary[] }
    | { type: "error.platform.getChats"; data: Error };

const liveConfig: Partial<MachineOptions<LoggedInContext, LoggedInEvents>> = {
    guards: {},
    services: {
        getChats: (ctx, _) => ctx.serviceContainer!.getChats(),
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
                        target: "chats_loaded",
                        actions: assign({
                            chats: (_, _ev) => [],
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
        chats_loaded: {},
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
