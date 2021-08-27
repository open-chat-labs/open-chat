// this is a simplified view of the register state machine states that the UI needs to know about

export type RegisterState =
    | "awaitingPhoneNumber"
    | "awaitingCode"
    | "verifying"
    | "awaitingUsername"
    | "awaitingCompletion"
    | "awaitingCanister"
    | { error: string };
