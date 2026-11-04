import type { ResourceKey } from "@client";
import { i18nKey } from "@src/i18n/i18n";

export type PrizeClaimStep =
    | { kind: "authenticate" }
    | { kind: "claim"; signInProof: string | undefined }
    | { kind: "failed"; message: ResourceKey };

/**
 * What to do when the user claims a prize. A prize that needs a captcha needs proof that the user
 * has just signed in: `signIn` is undefined until they have, and its `proof` is undefined when the
 * sign-in gave none. A claim without the proof can't succeed, so say so rather than ask the user
 * to sign in again.
 */
export function prizeClaimStep(
    requiresCaptcha: boolean,
    signIn: { proof: string | undefined } | undefined,
): PrizeClaimStep {
    if (!requiresCaptcha) return { kind: "claim", signInProof: undefined };
    if (signIn === undefined) return { kind: "authenticate" };
    if (signIn.proof === undefined) {
        return { kind: "failed", message: i18nKey("identity.failure.unexpectedError") };
    }
    return { kind: "claim", signInProof: signIn.proof };
}
