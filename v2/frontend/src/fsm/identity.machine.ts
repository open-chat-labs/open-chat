import type { Identity } from '@dfinity/agent';
import { createMachine, assign, MachineConfig, MachineOptions } from 'xstate';
import { getIdentity, login, logout, startSession } from "../api/auth";
import { useMachine } from "@xstate/svelte";
import { inspect } from '@xstate/inspect';

if (typeof window !== 'undefined') {
    inspect({
        iframe: false
    })
}

export interface IdentityContext {
    identity?: Identity
    error?: Error
}

export type IdentityEvents =
    | { type: 'ACKNOWLEDGE_EXPIRY' }
    | { type: 'REQUEST_IDENTITY' }
    | { type: 'REGISTER_USER', username: string }
    | { type: 'LOGOUT' }
    | { type: 'LOGIN' }
    | { type: 'done.invoke.getIdentity', data: Identity }
    | { type: 'error.platform.getIdentity', data: unknown }
    | { type: 'done.invoke.login', data: Identity }
    | { type: 'error.platform.login', data: unknown }
    | { type: 'done.invoke.logout' }
    | { type: 'error.platform.logout', data: unknown }

const liveConfig: Partial<MachineOptions<IdentityContext, IdentityEvents>> = {
    guards: {
        isAnonymous: (ctx) => ctx.identity ? ctx.identity.getPrincipal().isAnonymous() : true,
        notAnonymous: (ctx) => ctx.identity ? !ctx.identity.getPrincipal().isAnonymous() : false,
    },
    services: {
        login,
        logout,
        getIdentity,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        startSession: (ctx) => startSession(ctx.identity!),
    },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const schema: MachineConfig<IdentityContext, any, IdentityEvents> = {
    id: 'identity_machine',
    initial: 'requesting_identity',
    context: {
        identity: undefined,
        error: undefined,
    },
    states: {
        requesting_identity: {
            invoke: {
                id: 'getIdentity',
                src: 'getIdentity',
                onDone: {
                    target: 'loaded_identity',
                    actions: assign({
                        identity: (_, ev) => ev.data,
                    })
                },
                onError: {
                    target: 'failure',
                    actions: assign({
                        error: (_, ev) => ev.data
                    })
                }
            },
        },
        loaded_identity: {
            always:
                [
                    { target: 'login', cond: 'isAnonymous' },
                    { target: 'loading_user', cond: 'notAnonymous' }
                ]
        },
        loading_user: {
            // TODO - this is where we will load the user, but this is where we will stop for now
        },
        failure: {
            // TODO - add an entry condition here to check for 401 / 403 errors and go to the session 
            // expired state instead
            // Also add logging of the error
            on: {
                REQUEST_IDENTITY: 'requesting_identity'
            }
        },
        login: {
            on: {
                LOGIN: 'logging_in'
            }
        },
        logging_in: {
            invoke: {
                id: 'login',
                src: 'login',
                onDone: {
                    target: 'loaded_identity',
                    actions: assign({
                        identity: (_, ev) => ev.data
                    })
                },
                onError: {
                    target: 'failure',
                    actions: assign({
                        error: (_, ev) => ev.data
                    })
                }
            },
        },
        logged_in: {
            on: {
                LOGOUT: 'logging_out'
            },
            invoke: {
                id: 'startSession',
                src: 'startSession',
                onDone: {
                    target: 'expired',
                    actions: assign({
                        identity: (_, _ev) => undefined,
                    })
                },
            },
        },
        expired: {
            on: {
                ACKNOWLEDGE_EXPIRY: 'logging_in'
            }
        },
        logging_out: {
            invoke: {
                id: 'logout',
                src: 'logout',
                onDone: {
                    target: 'login',
                    actions: assign({
                        identity: (_, _ev) => undefined
                    })
                },
                onError: {
                    target: 'failure',
                    actions: assign({
                        identity: (_, _ev) => undefined
                    })
                }
            },
        }
    }
}

export const identityMachine = createMachine<IdentityContext, IdentityEvents>(schema, liveConfig);
export const identityService = useMachine(identityMachine, { devTools: process.env.NODE_ENV !== 'production' });
