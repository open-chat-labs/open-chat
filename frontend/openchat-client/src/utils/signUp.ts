import type { CreatedUser, RegisterUserResponse } from "@shared";

// Sign-up's handling of the backend's answer, shared by every UI's sign-up form.

/** The app's message for a refused registration, if it has one. */
export function registerFailureKey(kind: RegisterUserResponse["kind"]): string | undefined {
    switch (kind) {
        case "username_taken":
            return "register.usernameTaken";
        case "username_too_short":
            return "register.usernameTooShort";
        case "username_too_long":
            return "register.usernameTooLong";
        case "username_invalid":
            return "register.usernameInvalid";
        case "email_invalid":
            return "register.emailInvalid";
        case "user_limit_reached":
            return "register.userLimitReached";
        // there are no messages of their own for the other two (the old forms asked for keys that
        // were never written); this one covers them
        case "referral_code_invalid":
        case "referral_code_already_claimed":
        case "referral_code_expired":
            return "register.referralCodeInvalid";
        case "internal_error":
            return "unexpectedError";
        default:
            return undefined;
    }
}

/** The user a successful registration made, for `client.onRegisteredUser`. */
export function createdUser(
    username: string,
    resp: Extract<RegisterUserResponse, { kind: "success" }>,
): CreatedUser {
    return {
        kind: "created_user",
        username,
        dateCreated: BigInt(Date.now()),
        displayName: undefined,
        cryptoAccount: resp.icpAccount,
        userId: resp.userId,
        isPlatformModerator: false,
        isPlatformOperator: false,
        suspensionDetails: undefined,
        isSuspectedBot: false,
        diamondStatus: { kind: "inactive" },
        moderationFlagsEnabled: 0,
        updated: 0n,
        isBot: false,
        isUniquePerson: false,
        totalChitEarned: 0,
        chitBalance: 0,
        streak: 0,
        maxStreak: 0,
        hideOnlineStatus: false,
    };
}

/** Whether a refused registration was for its referral code (the form then offers to drop it). */
export function referralCodeRefused(kind: RegisterUserResponse["kind"]): boolean {
    return (
        kind === "referral_code_invalid" ||
        kind === "referral_code_already_claimed" ||
        kind === "referral_code_expired"
    );
}
