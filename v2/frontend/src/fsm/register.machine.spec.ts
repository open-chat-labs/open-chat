/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { Event, StateValue } from "xstate";
import { RegisterEvents, registerMachine } from "./register.machine";

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
            "awaiting_registration_code"
        );
    });

    test("enter reg code", () => {
        testTransition(
            "awaiting_registration_code",
            "SUBMIT_REGISTRATION_CODE",
            "checking_registration_code"
        );
    });

    test("resubmit reg code", () => {
        testTransition(
            "registration_code_invalid",
            "SUBMIT_REGISTRATION_CODE",
            "checking_registration_code"
        );
    });

    test("register user", () => {
        testTransition("registration_code_valid", "REGISTER_USER", "registering_user");
    });

    test("re-register user", () => {
        testTransition("registering_user_failed", "REGISTER_USER", "registering_user");
    });

    test("complete process", () => {
        testTransition("registering_user_succeeded", "COMPLETE", "registration_complete");
    });
});
