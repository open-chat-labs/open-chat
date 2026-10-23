import { ErrorCode } from "@shared";
import { memberDisplayNameResult, referralLink } from "./profile";

describe("the user's name in a community", () => {
    test("saves", () => {
        expect(memberDisplayNameResult({ kind: "success" })).toEqual({ kind: "saved" });
    });

    test("is turned down with a reason the user can fix", () => {
        const error = (code: ErrorCode) => ({ kind: "error" as const, code, message: undefined });
        expect(memberDisplayNameResult(error(ErrorCode.DisplayNameTooShort))).toEqual({
            kind: "rejected",
            message: "register.displayNameTooShort",
        });
        expect(memberDisplayNameResult(error(ErrorCode.InvalidDisplayName))).toEqual({
            kind: "rejected",
            message: "register.displayNameInvalid",
        });
        expect(memberDisplayNameResult(error(ErrorCode.InitiatorSuspended))).toEqual({
            kind: "rejected",
            message: "unexpectedError",
        });
    });

    test("fails offline", () => {
        expect(memberDisplayNameResult({ kind: "offline" })).toEqual({ kind: "failed" });
    });
});

describe("the referral link", () => {
    test("is the canonical origin plus /?ref=<current user id>", () => {
        expect(referralLink("https://oc.app", "abc-123")).toBe("https://oc.app/?ref=abc-123");
    });
});
