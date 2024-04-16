import type { GetDelegationResponse } from "./identity";

export type GenerateEmailVerificationCodeResponse =
    | { kind: "success" }
    | { kind: "email_invalid" }
    | { kind: "blocked"; until: bigint }
    | { kind: "failed_to_send_email"; error: string };

export type SignInWithEmailVerificationCodeResponse =
    | GetDelegationResponse
    | { kind: "incorrect_code" };

export type SubmitEmailVerificationCodeResponse =
    | { kind: "success"; userKey: Uint8Array; expiration: bigint }
    | { kind: "incorrect_code" }
    | { kind: "not_found" };
