import { derived, Writable } from "svelte/store";
import type { PhoneNumber } from "../domain/user/user";
import { AppState, appState } from "./appState";

export type RegisterError = {
    error?: Error;
};

export type RegisterPhoneNumber = RegisterError & {
    kind: "awaiting_phone_number";
};

export type RegisterVerifying = RegisterError & {
    kind: "verifying";
};

export type RegisterAwaitingUsername = RegisterError & {
    kind: "awaiting_username";
};

export type RegisterAwaitingCompletion = RegisterError & {
    kind: "awaiting_completion";
};

export type RegisterAwaitingCanister = RegisterError & {
    kind: "awaiting_canister";
};

export type RegisterUnknown = RegisterError & {
    kind: "unknown_state";
};

export type RegisterAwaitingCode = RegisterError & {
    kind: "awaiting_code";
    phoneNumber: PhoneNumber;
};

export type RegisterState =
    | RegisterPhoneNumber
    | RegisterAwaitingCode
    | RegisterVerifying
    | RegisterAwaitingUsername
    | RegisterAwaitingCompletion
    | RegisterAwaitingCanister
    | RegisterUnknown;

export const registerState = derived<Writable<AppState>, RegisterState>(appState, ($appState) => {
    let state: RegisterState = { kind: "unknown_state" };
    if ($appState.kind === "verifying_user") {
        switch ($appState.userState.kind) {
            case "unknown_user":
                state = $appState.verifying
                    ? { kind: "verifying", error: $appState.error }
                    : { kind: "awaiting_phone_number", error: $appState.error };
                break;
            case "unconfirmed_user":
                state = $appState.verifying
                    ? { kind: "verifying", error: $appState.error }
                    : {
                          kind: "awaiting_code",
                          phoneNumber: $appState.userState.phoneNumber,
                          error: $appState.error,
                      };
                break;
            case "confirmed_pending_username":
                state = { kind: "awaiting_username", error: $appState.error };
                break;
            // case "registering_user_succeeded":
            //     uiState = "awaitingCompletion";
            //     break;
            // case "resending_code":
            // case "checking_registration_code":
            // case "checking_phone_number":
            // case "registering_user":
            //     uiState = "verifying";
            //     break;
            // case "awaiting_canister":
            //     uiState = "awaitingCanister";
            //     break;
        }
    }
    return state;
});
