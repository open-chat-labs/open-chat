/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { Identity } from "@dfinity/agent";
import { createMachine, assign, MachineConfig, MachineOptions } from "xstate";
import { getIdentity, login, logout, startSession } from "../services/auth";
import { useMachine } from "@xstate/svelte";
import { inspect } from "@xstate/inspect";
import { ServiceContainer } from "../services/serviceContainer";
import type { User, GetCurrentUserResponse } from "../domain/user";
import { registerMachine } from "./register.machine";
import { rollbar } from "../utils/logging";
import { AuthError } from "../services/httpError";

if (typeof window !== "undefined") {
    inspect({
        iframe: false,
    });
}

export interface IdentityContext {
    identity?: Identity;
    error?: Error;
    serviceContainer?: ServiceContainer;
    user?: User;
    registrationFailure?: string;
}

type RegisterFailed = { kind: "failure" };
type RegisterSucceeded = { kind: "success" };

type RegisterResult = RegisterFailed | RegisterSucceeded;

export type IdentityEvents =
    | { type: "ACKNOWLEDGE_EXPIRY" }
    | { type: "REQUEST_IDENTITY" }
    | { type: "LOGOUT" }
    | { type: "LOGIN" }
    | { type: "done.invoke.getIdentity"; data: Identity }
    | { type: "error.platform.getIdentity"; data: Error }
    | { type: "done.invoke.login"; data: Identity }
    | { type: "error.platform.login"; data: Error }
    | { type: "done.invoke.logout" }
    | { type: "error.platform.logout"; data: Error }
    | { type: "done.invoke.getUser"; data: GetCurrentUserResponse }
    | { type: "error.platform.getUser"; data: Error }
    | { type: "done.invoke.registerMachine"; data: RegisterResult }
    | { type: "error.platform.registerMachine"; data: Error };

const liveConfig: Partial<MachineOptions<IdentityContext, IdentityEvents>> = {
    guards: {
        isAnonymous: ({ identity }) => (identity ? identity.getPrincipal().isAnonymous() : true),
        notAnonymous: ({ identity }) => (identity ? !identity.getPrincipal().isAnonymous() : false),
        userIsRegistered: (_, ev) => {
            if (ev.type === "done.invoke.getUser") {
                return ev.data.kind === "success";
            }
            return false;
        },
        userIsNotRegistered: (_, ev) => {
            if (ev.type === "done.invoke.getUser") {
                return ev.data.kind === "unknown";
            }
            return false;
        },
        registrationSucceeded: (_, ev) => {
            return ev.type === "done.invoke.registerMachine" && ev.data.kind === "success";
        },
        registrationFailed: (_, ev) => {
            return ev.type === "done.invoke.registerMachine" && ev.data.kind === "failure";
        },
        isAuthError: (ctx, _) => ctx.error instanceof AuthError,
    },
    services: {
        getUser: ({ serviceContainer }, _) => serviceContainer!.getCurrentUser(),
        login,
        logout,
        getIdentity,
        startSession: ({ identity }) => startSession(identity!),
    },
    actions: {
        logError: (ctx, _) => {
            if (ctx.error) {
                console.error(ctx.error);
                rollbar.error("Unexpected error", ctx.error);
            }
        },
    },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const schema: MachineConfig<IdentityContext, any, IdentityEvents> = {
    id: "identity_machine",
    initial: "requesting_identity",
    context: {
        identity: undefined,
        error: undefined,
    },
    states: {
        requesting_identity: {
            invoke: {
                id: "getIdentity",
                src: "getIdentity",
                onDone: {
                    target: "loaded_identity",
                    actions: assign({
                        identity: (_, { data }) => data,
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
        loaded_identity: {
            always: [
                { target: "login", cond: "isAnonymous" },
                { target: "loading_user", cond: "notAnonymous" },
            ],
        },
        loading_user: {
            entry: assign({
                serviceContainer: ({ identity }, _) =>
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    new ServiceContainer(identity!),
            }),
            invoke: {
                id: "getUser",
                src: "getUser",
                onDone: [
                    {
                        target: "logged_in",
                        cond: "userIsRegistered",
                        actions: assign({
                            user: (_, { data, type }) => {
                                console.log(data);
                                if (type === "done.invoke.getUser") {
                                    if (data.kind === "success") {
                                        return data.user;
                                    }
                                }
                                return undefined;
                            },
                        }),
                    },
                    {
                        target: "register_user",
                        cond: "userIsNotRegistered",
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
        register_user: {
            on: {
                LOGOUT: "logging_out",
            },
            invoke: {
                id: "registerMachine",
                src: registerMachine,
                data: (ctx, _ev) => ({
                    serviceContainer: ctx.serviceContainer,
                }),
                onDone: "logged_in",
                onError: {
                    target: "unexpected_error",
                    actions: assign({
                        error: (_, ev) => ev.data,
                    }),
                },
            },
        },
        unexpected_error: {
            always: {
                target: "expired",
                cond: "isAuthError",
            },
            entry: ["logError"],
            on: {
                REQUEST_IDENTITY: "requesting_identity",
            },
        },
        login: {
            on: {
                LOGIN: "logging_in",
            },
        },
        logging_in: {
            invoke: {
                id: "login",
                src: "login",
                onDone: {
                    target: "loaded_identity",
                    actions: assign({
                        identity: (_, { data }) => data,
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
        logged_in: {
            on: {
                LOGOUT: "logging_out",
            },
            invoke: {
                id: "startSession",
                src: "startSession",
                onDone: {
                    target: "expired",
                    actions: assign({
                        identity: (_, _ev) => undefined,
                        user: (_, _ev) => undefined,
                    }),
                },
            },
        },
        expired: {
            on: {
                ACKNOWLEDGE_EXPIRY: "logging_in",
            },
        },
        logging_out: {
            invoke: {
                id: "logout",
                src: "logout",
                onDone: {
                    target: "login",
                    actions: assign({
                        identity: (_, _ev) => undefined,
                    }),
                },
                onError: {
                    target: "unexpected_error",
                    actions: assign({
                        identity: (_, _ev) => undefined,
                    }),
                },
            },
        },
    },
};

export const identityMachine = createMachine<IdentityContext, IdentityEvents>(schema, liveConfig);
export const identityService = useMachine(identityMachine, {
    devTools: process.env.NODE_ENV !== "production",
});
