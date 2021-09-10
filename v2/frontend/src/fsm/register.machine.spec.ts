import { registerMachine } from "./register.machine";
import { testTransition } from "./machine.spec.utils";
import type { CurrentUserResponse } from "../domain/user/user";

const canisterRequired: CurrentUserResponse = {
    kind: "confirmed_user",
    canisterCreationStatus: "pending",
    username: "julian_jelfs",
};

const userCreated: CurrentUserResponse = {
    kind: "created_user",
    userId: "abcdefg",
    username: "julian_jelfs",
    accountBalance: BigInt(10000),
    canisterUpgradeStatus: "not_required",
};

describe("register machine transitions", () => {
    test("enter phone number", () => {
        testTransition(
            registerMachine,
            "awaiting_phone_number",
            "REQUEST_REGISTRATION_CODE",
            "checking_phone_number"
        );
    });

    describe("submitting phone number", () => {
        test("success", () => {
            testTransition(
                registerMachine,
                "checking_phone_number",
                { type: "done.invoke.submitPhoneNumber", data: { kind: "success" } },
                "awaiting_registration_code"
            );
        });

        test("already registered", () => {
            testTransition(
                registerMachine,
                "checking_phone_number",
                { type: "done.invoke.submitPhoneNumber", data: { kind: "already_registered" } },
                "awaiting_phone_number"
            );
        });

        test("already registered by other", () => {
            testTransition(
                registerMachine,
                "checking_phone_number",
                {
                    type: "done.invoke.submitPhoneNumber",
                    data: { kind: "already_registered_by_other" },
                },
                "awaiting_phone_number"
            );
        });

        test("invalid phone number", () => {
            testTransition(
                registerMachine,
                "checking_phone_number",
                {
                    type: "done.invoke.submitPhoneNumber",
                    data: { kind: "invalid_phone_number" },
                },
                "awaiting_phone_number"
            );
        });
    });

    test("submit reg code", () => {
        testTransition(
            registerMachine,
            "awaiting_registration_code",
            "SUBMIT_REGISTRATION_CODE",
            "checking_registration_code"
        );
    });

    test("change phone number ", () => {
        testTransition(
            registerMachine,
            "awaiting_registration_code",
            "CHANGE_PHONE_NUMBER",
            "awaiting_phone_number"
        );
    });

    describe("resending code", () => {
        test("triggering request", () => {
            testTransition(
                registerMachine,
                "awaiting_registration_code",
                "RESEND_REGISTRATION_CODE",
                "resending_code"
            );
        });

        test("request succeeds", () => {
            testTransition(
                registerMachine,
                "resending_code",
                {
                    type: "done.invoke.resendCode",
                    data: "success",
                },
                "awaiting_registration_code"
            );
        });
        test("already claimed", () => {
            testTransition(
                registerMachine,
                "resending_code",
                {
                    type: "done.invoke.resendCode",
                    data: "already_claimed",
                },
                "awaiting_registration_code"
            );
        });
        test("user not found", () => {
            testTransition(
                registerMachine,
                "resending_code",
                {
                    type: "done.invoke.resendCode",
                    data: "user_not_found",
                },
                "awaiting_registration_code"
            );
        });
    });

    describe("confirming phone number", () => {
        test("success", () => {
            testTransition(
                registerMachine,
                "checking_registration_code",
                {
                    type: "done.invoke.confirmPhoneNumber",
                    data: "success",
                },
                "awaiting_username"
            );
        });

        test("already claimed", () => {
            testTransition(
                registerMachine,
                "checking_registration_code",
                {
                    type: "done.invoke.confirmPhoneNumber",
                    data: "already_claimed",
                },
                "awaiting_registration_code"
            );
        });

        test("code incorrect", () => {
            testTransition(
                registerMachine,
                "checking_registration_code",
                {
                    type: "done.invoke.confirmPhoneNumber",
                    data: "code_incorrect",
                },
                "awaiting_registration_code"
            );
        });

        test("code expired", () => {
            testTransition(
                registerMachine,
                "checking_registration_code",
                {
                    type: "done.invoke.confirmPhoneNumber",
                    data: "code_expired",
                },
                "awaiting_registration_code"
            );
        });

        test("code not found", () => {
            testTransition(
                registerMachine,
                "checking_registration_code",
                {
                    type: "done.invoke.confirmPhoneNumber",
                    data: "not_found",
                },
                "awaiting_registration_code"
            );
        });
    });

    test("register user", () => {
        testTransition(registerMachine, "awaiting_username", "REGISTER_USER", "registering_user");
    });

    describe("checking user readiness", () => {
        test("when canister creation required", () => {
            testTransition(
                registerMachine,
                { checking_user_readiness: "loading_user" },
                {
                    type: "done.invoke.getUser",
                    data: canisterRequired,
                },
                { checking_user_readiness: "creating_canister" }
            );
        });
        test("when user is ready", () => {
            testTransition(
                registerMachine,
                { checking_user_readiness: "loading_user" },
                {
                    type: "done.invoke.getUser",
                    data: userCreated,
                },
                "registering_user_succeeded"
            );
        });
    });

    describe("setting username", () => {
        test("success", () => {
            testTransition(
                registerMachine,
                "registering_user",
                {
                    type: "done.invoke.setUsername",
                    data: "success",
                },
                { checking_user_readiness: "loading_user" }
            );
        });

        test("username taken", () => {
            testTransition(
                registerMachine,
                "registering_user",
                {
                    type: "done.invoke.setUsername",
                    data: "username_taken",
                },
                "awaiting_username"
            );
        });

        test("user not found", () => {
            testTransition(
                registerMachine,
                "registering_user",
                {
                    type: "done.invoke.setUsername",
                    data: "user_not_found",
                },
                "awaiting_username"
            );
        });

        test("username too short", () => {
            testTransition(
                registerMachine,
                "registering_user",
                {
                    type: "done.invoke.setUsername",
                    data: "username_too_short",
                },
                "awaiting_username"
            );
        });

        test("username too long", () => {
            testTransition(
                registerMachine,
                "registering_user",
                {
                    type: "done.invoke.setUsername",
                    data: "username_too_long",
                },
                "awaiting_username"
            );
        });

        test("username invalid", () => {
            testTransition(
                registerMachine,
                "registering_user",
                {
                    type: "done.invoke.setUsername",
                    data: "username_invalid",
                },
                "awaiting_username"
            );
        });
    });
});
