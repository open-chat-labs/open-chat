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
    error?: Error;
}

export type LoggedInEvents = { type: "WHATEVS" };

const liveConfig: Partial<MachineOptions<LoggedInContext, LoggedInEvents>> = {
    guards: {},
    services: {},
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const schema: MachineConfig<LoggedInContext, any, LoggedInEvents> = {
    id: "logged_in_machine",
    initial: "loading_chats",
    context: {},
    states: {
        loading_chats: {},
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
