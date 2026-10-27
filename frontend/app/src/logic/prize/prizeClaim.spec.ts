import { describe, expect, test } from "vitest";
import { prizeClaimStep } from "./prizeClaim";

describe("claiming a prize", () => {
    // Invariant: a prize claim that can't get a sign-in proof says it failed, rather than asking
    // the user to sign in again
    test("a sign-in that gave no proof fails the claim instead of asking again", () => {
        expect(prizeClaimStep(true, { proof: undefined })).toMatchObject({
            kind: "failed",
            message: { key: "identity.failure.unexpectedError" },
        });
    });

    // 5a invariant 2: a captcha prize is claimed only with a sign-in proof
    test("a prize that needs a captcha asks the user to sign in, then claims with the proof", () => {
        expect(prizeClaimStep(true, undefined)).toEqual({ kind: "authenticate" });
        expect(prizeClaimStep(true, { proof: "jwt" })).toEqual({
            kind: "claim",
            signInProof: "jwt",
        });
        expect(prizeClaimStep(false, undefined)).toEqual({ kind: "claim", signInProof: undefined });
    });
});
