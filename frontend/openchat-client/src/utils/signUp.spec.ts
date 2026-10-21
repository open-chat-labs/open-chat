import { referralCodeRefused, registerFailureKey } from "./signUp";

describe("a refused registration's message", () => {
    test("is the old sign-up's, with the referral code cases on the one key there is", () => {
        expect(registerFailureKey("username_taken")).toBe("register.usernameTaken");
        expect(registerFailureKey("user_limit_reached")).toBe("register.userLimitReached");
        expect(registerFailureKey("referral_code_expired")).toBe("register.referralCodeInvalid");
        expect(registerFailureKey("referral_code_already_claimed")).toBe(
            "register.referralCodeInvalid",
        );
        expect(registerFailureKey("internal_error")).toBe("unexpectedError");
    });
});

describe("a refused referral code", () => {
    test("is any of the three referral refusals, and nothing else", () => {
        expect(referralCodeRefused("referral_code_invalid")).toBe(true);
        expect(referralCodeRefused("referral_code_already_claimed")).toBe(true);
        expect(referralCodeRefused("referral_code_expired")).toBe(true);
        expect(referralCodeRefused("username_taken")).toBe(false);
    });
});
