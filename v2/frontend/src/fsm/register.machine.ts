/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { createMachine, MachineConfig, MachineOptions } from "xstate";
import { inspect } from "@xstate/inspect";
import type { ServiceContainer } from "../services/serviceContainer";

if (typeof window !== "undefined") {
    inspect({
        iframe: false,
    });
}

export interface RegisterContext {
    serviceContainer?: ServiceContainer;
    error: string;
}

export type RegisterEvents =
    | { type: "REQUEST_REGISTRATION_CODE"; countryCode: number; number: number }
    | { type: "SUBMIT_REGISTRATION_CODE"; code: number }
    | { type: "REGISTER_USER"; username: string }
    | { type: "COMPLETE" };

const liveConfig: Partial<MachineOptions<RegisterContext, RegisterEvents>> = {
    guards: {},
    services: {},
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const schema: MachineConfig<RegisterContext, any, RegisterEvents> = {
    id: "register_machine",
    initial: "awaiting_phone_number",
    context: { error: "" },
    states: {
        awaiting_phone_number: {
            on: {
                REQUEST_REGISTRATION_CODE: "awaiting_registration_code",
            },
        },
        awaiting_registration_code: {
            on: {
                SUBMIT_REGISTRATION_CODE: "checking_registration_code",
            },
        },
        checking_registration_code: {
            after: {
                1500: "registration_code_valid",
            },
        },
        registration_code_valid: {
            on: {
                REGISTER_USER: "registering_user",
            },
        },
        registration_code_invalid: {
            on: {
                SUBMIT_REGISTRATION_CODE: "checking_registration_code",
            },
        },
        registering_user: {
            after: {
                1500: "registering_user_succeeded",
            },
        },
        registering_user_failed: {
            on: {
                REGISTER_USER: "registering_user",
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
