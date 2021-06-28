/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { Event, MachineOptions, StateValue } from "xstate";
import { RegisterContext, RegisterEvents, registerMachine } from "./register.machine";
import type { Principal } from "@dfinity/principal";

type Config = Partial<MachineOptions<RegisterContext, RegisterEvents>>;

function testConfig(): Config {
    return {
        guards: {
            phoneNumberTaken: () => false,
            tooManyAttempts: () => false,
            claimInvalid: () => false,
            claimExpired: () => false,
            userExists: () => false,
            userLimitReached: () => false,
            usernameTaken: () => false,
            userNotFound: () => false,
            usernameTooShort: () => false,
            usernameTooLong: () => false,
        },
        services: {
            registerPhoneNumber: () => jest.fn(),
            claimPhoneNumber: () => jest.fn(),
            updateUsername: () => jest.fn(),
        },
    };
}

function updateConfig(partialGuards: any = {}) {
    const defaultConfig = testConfig();
    return {
        ...defaultConfig,
        guards: {
            ...defaultConfig.guards,
            ...partialGuards,
        },
    };
}

describe("identity machine transitions", () => {
    function testTransition(from: StateValue, ev: Event<RegisterEvents>, to: StateValue) {
        const machine = registerMachine;
        const nextState = machine.transition(from, ev);
        expect(nextState.value).toBe(to);
    }

    test("enter phone number", () => {
        testTransition(
            "awaiting_phone_number",
            "REQUEST_REGISTRATION_CODE",
            "checking_phone_number"
        );
    });

    test("checking phone number - success", () => {
        testTransition(
            "checking_phone_number",
            "done.invoke.registerPhoneNumber",
            "awaiting_registration_code"
        );
    });

    test("checking phone number - taken", () => {
        testTransition(
            "checking_phone_number",
            { type: "done.invoke.registerPhoneNumber", data: "taken" },
            "awaiting_phone_number"
        );
    });

    test("checking phone number - too many attempts", () => {
        testTransition(
            "checking_phone_number",
            { type: "done.invoke.registerPhoneNumber", data: "too_many_attempts" },
            "awaiting_phone_number"
        );
    });

    test("checking phone number - error", () => {
        testTransition(
            "checking_phone_number",
            "error.platform.registerPhoneNumber",
            "unexpected_error"
        );
    });

    test("submit reg code", () => {
        testTransition(
            "awaiting_registration_code",
            "SUBMIT_REGISTRATION_CODE",
            "checking_registration_code"
        );
    });

    test("request new reg code", () => {
        testTransition(
            "awaiting_registration_code",
            "RESEND_REGISTRATION_CODE",
            "checking_phone_number"
        );
    });

    test("claim phone number - success", () => {
        testTransition(
            "checking_registration_code",
            {
                type: "done.invoke.claimPhoneNumber",
                data: { kind: "success", canisterId: {} as Principal },
            },
            "awaiting_username"
        );
    });

    test("claim phone number - invalid", () => {
        testTransition(
            "checking_registration_code",
            {
                type: "done.invoke.claimPhoneNumber",
                data: { kind: "invalid" },
            },
            "awaiting_registration_code"
        );
    });

    test("claim phone number - expired", () => {
        testTransition(
            "checking_registration_code",
            {
                type: "done.invoke.claimPhoneNumber",
                data: { kind: "expired" },
            },
            "awaiting_registration_code"
        );
    });

    test("claim phone number - user exists", () => {
        testTransition(
            "checking_registration_code",
            {
                type: "done.invoke.claimPhoneNumber",
                data: { kind: "user_exists" },
            },
            "awaiting_registration_code"
        );
    });

    test("claim phone number - user limit reached", () => {
        testTransition(
            "checking_registration_code",
            {
                type: "done.invoke.claimPhoneNumber",
                data: { kind: "user_limit_reached" },
            },
            "awaiting_registration_code"
        );
    });

    test("register user", () => {
        testTransition("awaiting_username", "REGISTER_USER", "registering_user");
    });

    test("update username - success", () => {
        testTransition(
            "registering_user",
            {
                type: "done.invoke.updateUsername",
                data: "success",
            },
            "registering_user_succeeded"
        );
    });

    test("update username - username taken", () => {
        testTransition(
            "registering_user",
            {
                type: "done.invoke.updateUsername",
                data: "username_taken",
            },
            "awaiting_username"
        );
    });

    test("update username - user not found", () => {
        testTransition(
            "registering_user",
            {
                type: "done.invoke.updateUsername",
                data: "user_not_found",
            },
            "awaiting_username"
        );
    });

    test("update username - username too short", () => {
        testTransition(
            "registering_user",
            {
                type: "done.invoke.updateUsername",
                data: "username_too_short",
            },
            "awaiting_username"
        );
    });

    test("update username - username too long", () => {
        testTransition(
            "registering_user",
            {
                type: "done.invoke.updateUsername",
                data: "username_too_long",
            },
            "awaiting_username"
        );
    });
});
