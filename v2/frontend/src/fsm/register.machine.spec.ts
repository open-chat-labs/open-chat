import { registerMachine } from "./register.machine";
import type { Principal } from "@dfinity/principal";
import { testTransition } from "./machine.spec.utils";

describe("identity machine transitions", () => {
    test("enter phone number", () => {
        testTransition(
            registerMachine,
            "awaiting_phone_number",
            "REQUEST_REGISTRATION_CODE",
            "checking_phone_number"
        );
    });

    test("checking phone number - success", () => {
        testTransition(
            registerMachine,
            "checking_phone_number",
            "done.invoke.registerPhoneNumber",
            "awaiting_registration_code"
        );
    });

    test("checking phone number - taken", () => {
        testTransition(
            registerMachine,
            "checking_phone_number",
            { type: "done.invoke.registerPhoneNumber", data: "taken" },
            "awaiting_phone_number"
        );
    });

    test("checking phone number - too many attempts", () => {
        testTransition(
            registerMachine,
            "checking_phone_number",
            { type: "done.invoke.registerPhoneNumber", data: "too_many_attempts" },
            "awaiting_phone_number"
        );
    });

    test("checking phone number - error", () => {
        testTransition(
            registerMachine,
            "checking_phone_number",
            "error.platform.registerPhoneNumber",
            "unexpected_error"
        );
    });

    test("submit reg code", () => {
        testTransition(
            registerMachine,
            "awaiting_registration_code",
            "SUBMIT_REGISTRATION_CODE",
            "checking_registration_code"
        );
    });

    test("request new reg code", () => {
        testTransition(
            registerMachine,
            "awaiting_registration_code",
            "RESEND_REGISTRATION_CODE",
            "checking_phone_number"
        );
    });

    test("claim phone number - success", () => {
        testTransition(
            registerMachine,
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
            registerMachine,
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
            registerMachine,
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
            registerMachine,
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
            registerMachine,
            "checking_registration_code",
            {
                type: "done.invoke.claimPhoneNumber",
                data: { kind: "user_limit_reached" },
            },
            "awaiting_registration_code"
        );
    });

    test("register user", () => {
        testTransition(registerMachine, "awaiting_username", "REGISTER_USER", "registering_user");
    });

    test("update username - success", () => {
        testTransition(
            registerMachine,
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
            registerMachine,
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
            registerMachine,
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
            registerMachine,
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
            registerMachine,
            "registering_user",
            {
                type: "done.invoke.updateUsername",
                data: "username_too_long",
            },
            "awaiting_username"
        );
    });
});
