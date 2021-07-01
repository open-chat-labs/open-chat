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
import type {
    ConfirmPhoneNumberResponse,
    SubmitPhoneNumberResponse,
    SetUsernameResponse,
    CurrentUserResponse,
    PhoneNumber,
} from "../domain/user";

if (typeof window !== "undefined") {
    inspect({
        iframe: false,
    });
}

export interface RegisterContext {
    currentUser?: CurrentUserResponse;
    serviceContainer?: ServiceContainer;
    error?: Error;
    phoneNumber?: PhoneNumber;
    registrationCode?: string;
    userCanister?: Principal;
    username?: string;
    timeUntilResendCodePermitted: bigint;
}

export type RegisterEvents =
    | { type: "REQUEST_REGISTRATION_CODE"; phoneNumber: PhoneNumber }
    | { type: "RESEND_REGISTRATION_CODE" }
    | { type: "CHANGE_PHONE_NUMBER" }
    | { type: "SUBMIT_REGISTRATION_CODE"; code: string }
    | { type: "REGISTER_USER"; username: string }
    | { type: "COMPLETE" }
    | { type: "done.invoke.confirmPhoneNumber"; data: ConfirmPhoneNumberResponse }
    | { type: "error.platform.confirmPhoneNumber"; data: Error }
    | { type: "done.invoke.submitPhoneNumber"; data: SubmitPhoneNumberResponse }
    | { type: "error.platform.submitPhoneNumber"; data: Error }
    | { type: "done.invoke.setUsername"; data: SetUsernameResponse }
    | { type: "error.platform.setUsername"; data: Error };

const liveConfig: Partial<MachineOptions<RegisterContext, RegisterEvents>> = {
    guards: {
        isAwaitingPhoneNumber: (ctx, _) => {
            return ctx.currentUser?.kind === "unknown_user";
        },
        isAwaitingCode: (ctx, _) => {
            return ctx.currentUser?.kind === "unconfirmed_user";
        },
        isAwaitingUsername: (ctx, _) => {
            return ctx.currentUser?.kind === "confirmed_pending_username";
        },
        phoneAlreadyRegistered: (_, ev) => {
            return (
                ev.type === "done.invoke.submitPhoneNumber" && ev.data.kind === "already_registered"
            );
        },
        phoneAlreadyRegisteredByAnother: (_, ev) => {
            return (
                ev.type === "done.invoke.submitPhoneNumber" &&
                ev.data.kind === "already_registered_by_other"
            );
        },
        phoneAlreadyRegisteredButUnclaimed: (_, ev) => {
            return (
                ev.type === "done.invoke.submitPhoneNumber" &&
                ev.data.kind === "already_registered_but_unclaimed"
            );
        },
        phoneInvalid: (_, ev) => {
            return (
                ev.type === "done.invoke.submitPhoneNumber" &&
                ev.data.kind === "invalid_phone_number"
            );
        },
        alreadyClaimed: (_, ev) => {
            return ev.type === "done.invoke.confirmPhoneNumber" && ev.data === "already_claimed";
        },
        codeIncorrect: (_, ev) => {
            return ev.type === "done.invoke.confirmPhoneNumber" && ev.data === "code_incorrect";
        },
        codeExpired: (_, ev) => {
            return ev.type === "done.invoke.confirmPhoneNumber" && ev.data === "code_expired";
        },
        codeNotFound: (_, ev) => {
            return ev.type === "done.invoke.confirmPhoneNumber" && ev.data === "not_found";
        },
        usernameTaken: (_, ev) => {
            return ev.type === "done.invoke.setUsername" && ev.data === "username_taken";
        },
        userNotFound: (_, ev) => {
            return ev.type === "done.invoke.setUsername" && ev.data === "user_not_found";
        },
        usernameTooShort: (_, ev) => {
            return ev.type === "done.invoke.setUsername" && ev.data === "username_too_short";
        },
        usernameTooLong: (_, ev) => {
            return ev.type === "done.invoke.setUsername" && ev.data === "username_too_long";
        },
        usernameInvalid: (_, ev) => {
            return ev.type === "done.invoke.setUsername" && ev.data === "username_invalid";
        },
    },
    services: {
        submitPhoneNumber: (ctx, _) => ctx.serviceContainer!.submitPhoneNumber(ctx.phoneNumber!),
        confirmPhoneNumber: (ctx, _) =>
            ctx.serviceContainer!.confirmPhoneNumber(ctx.registrationCode!),
        setUsername: (ctx, ev) => {
            if (ev.type === "REGISTER_USER") {
                return ctx.serviceContainer!.setUsername(ev.username);
            }
            throw new Error(`setUsername called with unexpected event type: ${ev.type}`);
        },
    },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const schema: MachineConfig<RegisterContext, any, RegisterEvents> = {
    id: "register_machine",
    initial: "initial",
    context: { timeUntilResendCodePermitted: BigInt(1000) },
    states: {
        initial: {
            always: [
                { target: "awaiting_phone_number", cond: "isAwaitingPhoneNumber" },
                { target: "awaiting_registration_code", cond: "isAwaitingCode" },
                { target: "awaiting_username", cond: "isAwaitingUsername" },
                // { target: "loading_user", cond: "requiresCanisterCreation" },
                // { target: "loading_user", cond: "canisterCreationInProgress" },
            ],
        },
        awaiting_phone_number: {
            on: {
                REQUEST_REGISTRATION_CODE: "checking_phone_number",
            },
        },
        checking_phone_number: {
            entry: assign({
                error: (_, _ev) => undefined,
                phoneNumber: (ctx, ev) =>
                    ev.type === "REQUEST_REGISTRATION_CODE" ? ev.phoneNumber : ctx.phoneNumber,
            }),
            invoke: {
                id: "submitPhoneNumber",
                src: "submitPhoneNumber",
                onDone: [
                    {
                        target: "awaiting_phone_number",
                        cond: "phoneAlreadyRegistered",
                        actions: assign({
                            error: (_, _ev) => new Error("register.phoneAlreadyRegistered"),
                        }),
                    },
                    {
                        target: "awaiting_phone_number",
                        cond: "phoneAlreadyRegisteredByAnother",
                        actions: assign({
                            error: (_, _ev) =>
                                new Error("register.phoneAlreadyRegisteredByAnother"),
                        }),
                    },
                    {
                        target: "awaiting_phone_number",
                        cond: "phoneAlreadyRegisteredButUnclaimed",
                        actions: assign({
                            error: (_, _ev) =>
                                new Error("register.phoneAlreadyRegisteredButUnclaimed"),
                        }),
                    },
                    {
                        target: "awaiting_phone_number",
                        cond: "phoneInvalid",
                        actions: assign({
                            error: (_, _ev) => new Error("register.phoneInvalid"),
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
                CHANGE_PHONE_NUMBER: "awaiting_phone_number",
            },
        },
        checking_registration_code: {
            entry: assign({
                error: (_, _ev) => undefined,
                registrationCode: (_, ev) =>
                    ev.type === "SUBMIT_REGISTRATION_CODE" ? ev.code : undefined,
            }),
            invoke: {
                id: "confirmPhoneNumber",
                src: "confirmPhoneNumber",
                onDone: [
                    {
                        target: "awaiting_registration_code",
                        cond: "alreadyClaimed",
                        actions: assign({
                            error: (_, _ev) => new Error("register.alreadyClaimed"),
                        }),
                    },
                    {
                        target: "awaiting_registration_code",
                        cond: "codeIncorrect",
                        actions: assign({
                            error: (_, _ev) => new Error("register.codeIncorrect"),
                        }),
                    },
                    {
                        target: "awaiting_registration_code",
                        cond: "codeExpired",
                        actions: assign({
                            error: (_, _ev) => new Error("register.codeExpired"),
                        }),
                    },
                    {
                        target: "awaiting_registration_code",
                        cond: "codeNotFound",
                        actions: assign({
                            error: (_, _ev) => new Error("register.codeNotFound"),
                        }),
                    },
                    {
                        target: "awaiting_username",
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
                id: "setUsername",
                src: "setUsername",
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
                        target: "awaiting_username",
                        cond: "usernameInvalid",
                        actions: assign({
                            error: (_, _ev) => new Error("register.usernameInvalid"),
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
            data: {
                kind: () => "success",
            },
        },
        unexpected_error: {
            type: "final",
            entry: sendParent((ctx, _) => ({
                type: "error.platform.registerMachine",
                data: ctx.error,
            })),
        },
    },
};

export const registerMachine = createMachine<RegisterContext, RegisterEvents>(schema, liveConfig);
export type RegisterMachine = typeof registerMachine;
