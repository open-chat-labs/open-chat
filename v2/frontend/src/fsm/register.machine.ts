/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { assign, createMachine, DoneInvokeEvent, MachineConfig, MachineOptions } from "xstate";
import { inspect } from "@xstate/inspect";
import type { ServiceContainer } from "../services/serviceContainer";
import type { ClaimResponse, RegisterResponse } from "../domain/phone";
import type { Principal } from "@dfinity/principal";
import type { UpdateUsernameResponse } from "../domain/user";

if (typeof window !== "undefined") {
    inspect({
        iframe: false,
    });
}

export interface RegisterContext {
    serviceContainer?: ServiceContainer;
    error?: Error;
    countryCode?: number;
    phoneNumber?: number;
    registrationCode?: number;
    userCanister?: Principal;
    username?: string;
}

export type RegisterEvents =
    | { type: "REQUEST_REGISTRATION_CODE"; countryCode: number; number: number }
    | { type: "RESEND_REGISTRATION_CODE" }
    | { type: "SUBMIT_REGISTRATION_CODE"; code: number }
    | { type: "REGISTER_USER"; username: string }
    | { type: "COMPLETE" }
    | { type: "done.invoke.claimPhoneNumber"; data: ClaimResponse }
    | { type: "error.platform.claimPhoneNumber"; data: unknown }
    | { type: "done.invoke.registerPhoneNumber"; data: RegisterResponse }
    | { type: "error.platform.registerPhoneNumber"; data: unknown }
    | { type: "done.invoke.updateUsername"; data: UpdateUsernameResponse }
    | { type: "error.platform.updateUsername"; data: unknown };

const liveConfig: Partial<MachineOptions<RegisterContext, RegisterEvents>> = {
    guards: {
        phoneNumberTaken: (_, ev) => {
            return ev.type === "done.invoke.registerPhoneNumber" && ev.data === "taken";
        },
        tooManyAttempts: (_, ev) => {
            return ev.type === "done.invoke.registerPhoneNumber" && ev.data === "too_many_attempts";
        },
        claimInvalid: (_, ev) => {
            return ev.type === "done.invoke.claimPhoneNumber" && ev.data.kind === "invalid";
        },
        claimExpired: (_, ev) => {
            return ev.type === "done.invoke.claimPhoneNumber" && ev.data.kind === "expired";
        },
        userExists: (_, ev) => {
            return ev.type === "done.invoke.claimPhoneNumber" && ev.data.kind === "user_exists";
        },
        userLimitReached: (_, ev) => {
            return (
                ev.type === "done.invoke.claimPhoneNumber" && ev.data.kind === "user_limit_reached"
            );
        },
        usernameTaken: (_, ev) => {
            return ev.type === "done.invoke.updateUsername" && ev.data === "username_taken";
        },
        userNotFound: (_, ev) => {
            return ev.type === "done.invoke.updateUsername" && ev.data === "user_not_found";
        },
        usernameTooShort: (_, ev) => {
            return ev.type === "done.invoke.updateUsername" && ev.data === "username_too_short";
        },
        usernameTooLong: (_, ev) => {
            return ev.type === "done.invoke.updateUsername" && ev.data === "username_too_long";
        },
    },
    services: {
        registerPhoneNumber: (ctx, _) =>
            ctx.serviceContainer!.registerPhoneNumber(ctx.countryCode!, ctx.phoneNumber!),
        claimPhoneNumber: (ctx, _) =>
            ctx.serviceContainer!.claimPhoneNumber(
                ctx.registrationCode!,
                ctx.countryCode!,
                ctx.phoneNumber!
            ),
        updateUsername: (ctx, ev) => {
            if (ev.type === "REGISTER_USER") {
                return ctx.serviceContainer!.updateUsername(ctx.userCanister!, ev.username);
            }
            // todo - not completely sure what happens if we throw here
            // todo - can we avoid this by using Typestates?
            throw new Error(`updateUsername called with unexpected event type: ${ev.type}`);
        },
    },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const schema: MachineConfig<RegisterContext, any, RegisterEvents> = {
    id: "register_machine",
    initial: "awaiting_phone_number",
    context: {},
    states: {
        awaiting_phone_number: {
            on: {
                REQUEST_REGISTRATION_CODE: "checking_phone_number",
            },
        },
        checking_phone_number: {
            entry: assign({
                error: (_, _ev) => undefined,
                countryCode: (ctx, ev) =>
                    ev.type === "REQUEST_REGISTRATION_CODE"
                        ? ev.countryCode
                        : ctx.countryCode ?? undefined,
                phoneNumber: (ctx, ev) =>
                    ev.type === "REQUEST_REGISTRATION_CODE"
                        ? ev.number
                        : ctx.phoneNumber ?? undefined,
            }),
            invoke: {
                id: "registerPhoneNumber",
                src: "registerPhoneNumber",
                onDone: [
                    {
                        target: "awaiting_phone_number",
                        cond: "phoneNumberTaken",
                        actions: assign({
                            // todo - is this the right place to do this
                            error: (_, _ev) => new Error("register.phoneNumberTaken"),
                        }),
                    },
                    {
                        target: "awaiting_phone_number",
                        cond: "tooManyAttempts",
                        actions: assign({
                            // todo - is this the right place to do this
                            error: (_, _ev) => new Error("register.tooManyAttempts"),
                        }),
                    },
                    {
                        target: "awaiting_registration_code",
                        actions: assign({
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
        awaiting_registration_code: {
            on: {
                SUBMIT_REGISTRATION_CODE: "checking_registration_code",
                RESEND_REGISTRATION_CODE: "checking_phone_number",
            },
        },
        checking_registration_code: {
            entry: assign({
                error: (_, _ev) => undefined,
                registrationCode: (_, ev) =>
                    ev.type === "SUBMIT_REGISTRATION_CODE" ? ev.code : undefined,
            }),
            invoke: {
                id: "claimPhoneNumber",
                src: "claimPhoneNumber",
                onDone: [
                    {
                        target: "awaiting_registration_code",
                        cond: "claimInvalid",
                        actions: assign({
                            error: (_, _ev) => new Error("register.claimInvalid"),
                        }),
                    },
                    {
                        target: "awaiting_registration_code",
                        cond: "claimExpired",
                        actions: assign({
                            error: (_, _ev) => new Error("register.claimExpired"),
                        }),
                    },
                    {
                        target: "awaiting_registration_code",
                        cond: "userExists",
                        actions: assign({
                            error: (_, _ev) => new Error("register.userExists"),
                        }),
                    },
                    {
                        target: "awaiting_registration_code",
                        cond: "userLimitReached",
                        actions: assign({
                            error: (_, _ev) => new Error("register.userLimitReached"),
                        }),
                    },
                    {
                        target: "awaiting_username",
                        actions: assign({
                            userCanister: (_, { type, data }: DoneInvokeEvent<ClaimResponse>) => {
                                if (type === "done.invoke.claimPhoneNumber") {
                                    if (data.kind === "success") {
                                        return data.canisterId;
                                    }
                                }
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
        awaiting_username: {
            on: {
                REGISTER_USER: "registering_user",
            },
        },
        registering_user: {
            entry: assign({
                username: (_, ev) => (ev.type === "REGISTER_USER" ? ev.username : undefined),
            }),
            invoke: {
                id: "updateUsername",
                src: "updateUsername",
                onDone: [
                    {
                        target: "awaiting_username",
                        cond: "usernameTaken",
                        actions: assign({
                            error: (_, _ev) => new Error("register.usernameTaken"),
                        }),
                    },
                    {
                        target: "awaiting_username",
                        cond: "userNotFound",
                        actions: assign({
                            error: (_, _ev) => new Error("register.userNotFound"),
                        }),
                    },
                    {
                        target: "awaiting_username",
                        cond: "usernameTooShort",
                        actions: assign({
                            error: (_, _ev) => new Error("register.usernameTooShort"),
                        }),
                    },
                    {
                        target: "awaiting_username",
                        cond: "usernameTooLong",
                        actions: assign({
                            error: (_, _ev) => new Error("register.usernameTooLong"),
                        }),
                    },
                    {
                        target: "registering_user_succeeded",
                        actions: assign({
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
        registering_user_succeeded: {
            on: {
                COMPLETE: "registration_complete",
            },
        },
        registration_complete: {
            type: "final",
        },
        unexpected_error: {},
    },
};

export const registerMachine = createMachine<RegisterContext, RegisterEvents>(schema, liveConfig);
export type RegisterMachine = typeof registerMachine;
