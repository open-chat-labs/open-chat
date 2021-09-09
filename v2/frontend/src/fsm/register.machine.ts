/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
    assign,
    createMachine,
    MachineConfig,
    MachineOptions,
    sendParent,
    DoneInvokeEvent,
} from "xstate";
import type { ServiceContainer } from "../services/serviceContainer";
import type { Principal } from "@dfinity/principal";
import type {
    ConfirmPhoneNumberResponse,
    SubmitPhoneNumberResponse,
    SetUsernameResponse,
    CurrentUserResponse,
    PhoneNumber,
    ResendCodeResponse,
} from "../domain/user/user";
import { log } from "xstate/lib/actions";

const CANISTER_CREATION_INTERVAL = 1000;

export interface RegisterContext {
    currentUser?: CurrentUserResponse;
    serviceContainer?: ServiceContainer;
    error?: Error;
    phoneNumber?: PhoneNumber;
    registrationCode?: string;
    userCanister?: Principal;
    username?: string;
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
    | { type: "error.platform.setUsername"; data: Error }
    | { type: "done.invoke.getUser"; data: CurrentUserResponse }
    | { type: "error.platform.getUser"; data: Error }
    | { type: "done.invoke.createCanister" }
    | { type: "error.platform.createCanister"; data: Error }
    | { type: "done.invoke.resendCode"; data: ResendCodeResponse }
    | { type: "error.platform.resendCode"; data: Error };

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
        isAwaitingCanister: (ctx, _) => {
            return ctx.currentUser?.kind === "confirmed_user";
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
        phoneInvalid: (_, ev) => {
            return (
                ev.type === "done.invoke.submitPhoneNumber" &&
                ev.data.kind === "invalid_phone_number"
            );
        },
        confirmAlreadyClaimed: (_, ev) => {
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
        resendAlreadyClaimed: (_, ev) => {
            return ev.type === "done.invoke.resendCode" && ev.data === "already_claimed";
        },
        resendUserNotFound: (_, ev) => {
            return ev.type === "done.invoke.resendCode" && ev.data === "user_not_found";
        },
        shouldCreateCanister: (_, ev) => {
            console.log("should create canister: ", ev);
            return (
                ev.type === "done.invoke.getUser" &&
                (ev.data.kind === "confirmed_user" ||
                    ev.data.kind === "confirmed_pending_username") &&
                ev.data.canisterCreationStatus === "pending"
            );
        },
        userIsRegistered: (_, ev) => {
            return ev.type === "done.invoke.getUser" && ev.data.kind == "created_user";
        },
    },
    services: {
        getUser: ({ serviceContainer }, _) => serviceContainer!.getCurrentUser(),
        resendCode: (ctx, _) => ctx.serviceContainer!.resendRegistrationCode(),
        submitPhoneNumber: (ctx, _) => ctx.serviceContainer!.submitPhoneNumber(ctx.phoneNumber!),
        confirmPhoneNumber: (ctx, _) =>
            ctx.serviceContainer!.confirmPhoneNumber(ctx.registrationCode!),
        setUsername: (ctx, ev) => {
            if (ev.type === "REGISTER_USER") {
                return ctx.serviceContainer!.setUsername(ev.username);
            }
            throw new Error(`setUsername called with unexpected event type: ${ev.type}`);
        },
        createCanister: ({ serviceContainer }, _) => serviceContainer!.createCanister(),
    },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const schema: MachineConfig<RegisterContext, any, RegisterEvents> = {
    id: "register_machine",
    initial: "initial",
    context: {},
    states: {
        initial: {
            always: [
                { target: "awaiting_phone_number", cond: "isAwaitingPhoneNumber" },
                { target: "awaiting_registration_code", cond: "isAwaitingCode" },
                { target: "awaiting_username", cond: "isAwaitingUsername" },
                { target: "awaiting_canister", cond: "isAwaitingCanister" },
            ],
        },
        awaiting_canister: {
            after: {
                [CANISTER_CREATION_INTERVAL]: "registration_complete",
            },
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
                RESEND_REGISTRATION_CODE: "resending_code",
                CHANGE_PHONE_NUMBER: "awaiting_phone_number",
            },
        },
        resending_code: {
            invoke: {
                id: "resendCode",
                src: "resendCode",
                onDone: [
                    {
                        target: "awaiting_registration_code",
                        cond: "resendAlreadyClaimed",
                        actions: assign({
                            error: (_, _ev) => new Error("register.resendAlreadyClaimed"),
                        }),
                    },
                    {
                        target: "awaiting_registration_code",
                        cond: "resendUserNotFound",
                        actions: assign({
                            error: (_, _ev) => new Error("register.userNotFound"),
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
                        cond: "confirmAlreadyClaimed",
                        actions: assign({
                            error: (_, _ev) => new Error("register.confirmAlreadyClaimed"),
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
                        target: "checking_user_readiness",
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
        checking_user_readiness: {
            initial: "loading_user",
            states: {
                loading_user: {
                    entry: log("entering loading_user"),
                    invoke: {
                        id: "getUser",
                        src: "getUser",
                        onDone: [
                            {
                                target: "creating_canister",
                                cond: "shouldCreateCanister",
                            },
                            {
                                target: "#registering_user_succeeded",
                                cond: "userIsRegistered",
                                actions: assign((_, ev: DoneInvokeEvent<CurrentUserResponse>) => ({
                                    currentUser: ev.data,
                                })),
                            },
                        ],
                        onError: {
                            target: "..unexpected_error",
                            actions: assign({
                                error: (_, { data }) => data,
                            }),
                        },
                    },
                },
                creating_canister: {
                    entry: log("entering creating_canister"),
                    invoke: {
                        id: "createCanister",
                        src: "createCanister",
                        onDone: "loading_user",
                        onError: {
                            target: "..unexpected_error",
                            actions: assign({
                                error: (_, { data }) => data,
                            }),
                        },
                    },
                },
            },
        },
        registering_user_succeeded: {
            id: "registering_user_succeeded",
            on: {
                COMPLETE: "registration_complete",
            },
        },
        registration_complete: {
            type: "final",
            data: (ctx, _) => ctx.currentUser,
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
