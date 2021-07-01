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
import type { Principal } from "@dfinity/principal";
import type { User } from "../domain/user";

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

export type LoggedInEvents = { type: "WHATEVS" };

const liveConfig: Partial<MachineOptions<LoggedInContext, LoggedInEvents>> = {
    guards: {},
    services: {
        getChats: (ctx, ev) => ctx.serviceContainer!.getChats(),
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
                            chats: (_, ev) => [],
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
