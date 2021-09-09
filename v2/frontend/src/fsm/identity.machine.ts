/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { Identity } from "@dfinity/agent";
import { createMachine, assign, MachineConfig, MachineOptions, DoneInvokeEvent } from "xstate";
import { getIdentity, login, logout, startSession } from "../services/auth";
import { useMachine } from "@xstate/svelte";
import { inspect } from "@xstate/inspect";
import { ServiceContainer } from "../services/serviceContainer";
import type { User, CurrentUserResponse } from "../domain/user/user";
import { registerMachine } from "./register.machine";
import { rollbar } from "../utils/logging";
import { AuthError } from "../services/httpError";
import { homeMachine } from "./home.machine";

const UPGRADE_POLL_INTERVAL = 1000;

if (typeof window !== "undefined" && Boolean(process.env.SHOW_XSTATE_INSPECTOR)) {
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
    | { type: "done.invoke.getUser"; data: CurrentUserResponse }
    | { type: "error.platform.getUser"; data: Error }
    | { type: "done.invoke.registerMachine"; data: RegisterResult }
    | { type: "error.platform.registerMachine"; data: Error }
    | { type: "done.invoke.upgradeUser" }
    | { type: "error.platform.upgradeUser"; data: Error };

const liveConfig: Partial<MachineOptions<IdentityContext, IdentityEvents>> = {
    guards: {
        isAnonymous: ({ identity }) => (identity ? identity.getPrincipal().isAnonymous() : true),
        notAnonymous: ({ identity }) => (identity ? !identity.getPrincipal().isAnonymous() : false),
        userRequiresUpgrade: (_, ev) => {
            if (ev.type === "done.invoke.getUser") {
                if (ev.data.kind === "created_user") {
                    return ev.data.canisterUpgradeStatus === "required";
                }
                return false;
            }
            throw new Error(`Unexpected event type for userRequiresUpgrade guard: ${ev.type}`);
        },
        userUpgradeInProgress: (_, ev) => {
            if (ev.type === "done.invoke.getUser") {
                return (
                    ev.data.kind === "created_user" &&
                    ev.data.canisterUpgradeStatus === "in_progress"
                );
            }
            throw new Error(`Unexpected event type for userUpgradeInProgress guard: ${ev.type}`);
        },
        userIsRegistered: (_, ev) => {
            if (ev.type === "done.invoke.getUser" || ev.type === "done.invoke.registerMachine") {
                return ev.data.kind == "created_user";
            }
            throw new Error(`Unexpected event type for userIsRegistered guard: ${ev.type}`);
        },
        userIsNotRegistered: (_, ev) => {
            if (ev.type === "done.invoke.getUser") {
                return (
                    ev.data.kind === "confirmed_user" ||
                    ev.data.kind === "unknown_user" ||
                    ev.data.kind === "unconfirmed_user" ||
                    ev.data.kind === "confirmed_pending_username"
                );
            }
            throw new Error(`Unexpected event type for userIsNotRegistered guard: ${ev.type}`);
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
        upgradeUser: ({ serviceContainer }) => serviceContainer!.upgradeUser(),
        homeMachine: homeMachine,
        registerMachine,
    },
    actions: {
        logError: (ctx, _) => {
            if (ctx.error) {
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
                serviceContainer: ({ identity, serviceContainer }, _) =>
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    serviceContainer ?? new ServiceContainer(identity!),
            }),
            invoke: {
                id: "getUser",
                src: "getUser",
                onDone: [
                    {
                        target: "register_user",
                        cond: "userIsNotRegistered",
                    },
                    {
                        target: "upgrade_user",
                        cond: "userRequiresUpgrade",
                    },
                    {
                        target: "upgrading_user",
                        cond: "userUpgradeInProgress",
                    },
                    {
                        target: "logged_in",
                        cond: "userIsRegistered",
                        actions: assign({
                            serviceContainer: (
                                { serviceContainer },
                                ev: DoneInvokeEvent<CurrentUserResponse>
                            ) => {
                                if (ev.type === "done.invoke.getUser") {
                                    if (ev.data.kind === "created_user") {
                                        return serviceContainer!.createUserClient(ev.data.userId);
                                    }
                                }
                                return serviceContainer;
                            },
                            user: (_, ev: DoneInvokeEvent<CurrentUserResponse>) => {
                                if (ev.type === "done.invoke.getUser") {
                                    if (ev.data.kind === "created_user") {
                                        return { ...ev.data };
                                    }
                                }
                            },
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
        upgrade_user: {
            invoke: {
                id: "upgradeUser",
                src: "upgradeUser",
                onDone: "loading_user",
                onError: {
                    target: "unexpected_error",
                    actions: assign({
                        error: (_, ev) => ev.data,
                    }),
                },
            },
        },
        upgrading_user: {
            after: {
                [UPGRADE_POLL_INTERVAL]: "loading_user",
            },
        },
        register_user: {
            on: {
                LOGOUT: "logging_out",
            },
            invoke: {
                id: "registerMachine",
                src: "registerMachine",
                data: (ctx, ev) => {
                    let phoneNumber = undefined;
                    if (ev.type === "done.invoke.getUser" && ev.data.kind === "unconfirmed_user") {
                        phoneNumber = ev.data.phoneNumber;
                    }
                    return {
                        currentUser: ev.type === "done.invoke.getUser" ? ev.data : undefined,
                        serviceContainer: ctx.serviceContainer,
                        phoneNumber,
                    };
                },
                onDone: [
                    {
                        target: "logged_in",
                        cond: "userIsRegistered",
                        actions: assign({
                            serviceContainer: (
                                { serviceContainer },
                                ev: DoneInvokeEvent<CurrentUserResponse>
                            ) => {
                                console.log("Response from reg machine", ev);
                                if (ev.type === "done.invoke.registerMachine") {
                                    if (ev.data.kind === "created_user") {
                                        return serviceContainer!.createUserClient(ev.data.userId);
                                    }
                                }
                                return serviceContainer;
                            },
                            user: (_, ev: DoneInvokeEvent<CurrentUserResponse>) => {
                                if (ev.type === "done.invoke.registerMachine") {
                                    if (ev.data.kind === "created_user") {
                                        return { ...ev.data };
                                    }
                                }
                            },
                        }),
                    },
                ],
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
            invoke: [
                {
                    id: "homeMachine",
                    src: "homeMachine",
                    data: (ctx, _ev) => ({
                        serviceContainer: ctx.serviceContainer,
                        user: ctx.user,
                        chatSummaries: [],
                        userLookup: {},
                        usersLastUpdate: BigInt(0),
                        chatsIndex: {},
                    }),
                    onDone: "login",
                    onError: {
                        target: "unexpected_error",
                        actions: assign({
                            error: (_, ev) => ev.data,
                        }),
                    },
                },
                {
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
            ],
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
                    actions: assign((_, _ev) => ({
                        identity: undefined,
                        user: undefined,
                    })),
                },
                onError: {
                    target: "unexpected_error",
                    actions: assign((_, _ev) => ({
                        identity: undefined,
                        user: undefined,
                    })),
                },
            },
        },
    },
};

export const identityMachine = createMachine<IdentityContext, IdentityEvents>(schema, liveConfig);
export const identityService = useMachine(identityMachine, {
    devTools: Boolean(process.env.SHOW_XSTATE_INSPECTOR),
});
