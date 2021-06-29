/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { MachineOptions, StateValue } from "xstate";
import type { LoggedInContext, LoggedInEvents } from "./loggedin.machine";
import { testTransition } from "./machine.spec.utils";

type Config = Partial<MachineOptions<LoggedInContext, LoggedInEvents>>;

function testConfig(): Config {
    return {
        guards: {},
        services: {},
    };
}

describe("logged in machine transitions", () => {
    test("enter phone number", () => {
        // testTransition(
        //     loggedInMachine,
        //     "awaiting_phone_number",
        //     "REQUEST_REGISTRATION_CODE",
        //     "checking_phone_number"
        // );
    });
});
