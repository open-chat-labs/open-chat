import type { GetDelegationResponse, PrepareDelegationResponse } from "./identity";

export type GenerateEmailVerificationCodeResponse =
    | { kind: "success" }
    | { kind: "email_invalid" }
    | { kind: "blocked"; until: bigint }
    | { kind: "failed_to_send_email"; error: string };

export type SignInWithEmailVerificationCodeResponse = GetDelegationResponse | IncorrectCode;

export type SubmitEmailVerificationCodeResponse = PrepareDelegationResponse | IncorrectCode;

export type IncorrectCode = { 
    kind: "incorrect_code",
    blockedUntil: bigint | undefined,
    attemptsRemaining: number,
};
