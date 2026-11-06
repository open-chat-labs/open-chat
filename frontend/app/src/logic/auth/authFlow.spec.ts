import {
    afterAbandoned,
    referralCode,
    nextAuthKind,
    onAuthClosed,
    showsSignedOut,
    withoutAccount,
} from "./authFlow";

describe("whether / shows Landing", () => {
    test("for someone signed out, and through a sign-in started on Landing itself", () => {
        expect(showsSignedOut({ kind: "anon" }, true, false, false)).toBe(true);
        expect(showsSignedOut({ kind: "logging_in" }, true, true, false)).toBe(true);
        expect(showsSignedOut({ kind: "registering" }, true, true, false)).toBe(true);
    });

    test("not for a sign-in started anywhere else, nor once there's a user", () => {
        expect(showsSignedOut({ kind: "logging_in" }, true, false, false)).toBe(false);
        expect(
            showsSignedOut({ kind: "loading_user", registering: false }, true, false, false),
        ).toBe(false);
        expect(showsSignedOut({ kind: "logged_in" }, false, true, false)).toBe(false);
    });

    test("for a sign-up that failed on Landing, while the identity has no account", () => {
        expect(showsSignedOut({ kind: "registering" }, true, false, true)).toBe(true);
        expect(showsSignedOut({ kind: "loading_user", registering: true }, true, false, true)).toBe(
            true,
        );
        // without it, the app's own sign-up takes over
        expect(showsSignedOut({ kind: "registering" }, true, false, false)).toBe(false);
        expect(showsSignedOut({ kind: "logging_in" }, true, false, true)).toBe(false);
        expect(showsSignedOut({ kind: "logged_in" }, false, false, true)).toBe(false);
    });
});

describe("the in-app dialog's kind", () => {
    test("opens for a sign-in, turns into sign-up without an account, and closes with a user", () => {
        expect(nextAuthKind(null, { kind: "anon" })).toBeNull();
        expect(nextAuthKind(null, { kind: "logging_in" })).toBe("login");
        expect(nextAuthKind("login", { kind: "loading_user", registering: false })).toBe("login");
        expect(nextAuthKind("login", { kind: "registering" })).toBe("signup");
        expect(nextAuthKind(null, { kind: "loading_user", registering: true })).toBe("signup");
        expect(nextAuthKind("signup", { kind: "logged_in" })).toBeNull();
    });

    test("closes when a sign-in falls back to anonymous", () => {
        expect(nextAuthKind("login", { kind: "anon" })).toBeNull();
    });

    test("keeps sign-up while the client asks for sign-in again", () => {
        expect(nextAuthKind("signup", { kind: "logging_in" })).toBe("signup");
    });
});

describe("closing the in-app dialog, or leaving the app with it open", () => {
    test("gives up a sign-in still going", () => {
        expect(onAuthClosed({ kind: "logging_in" })).toBe("anon");
    });

    test("leaves any other identity to the sign-in callbacks", () => {
        expect(onAuthClosed({ kind: "registering" })).toBeUndefined();
        expect(onAuthClosed({ kind: "anon" })).toBeUndefined();
        expect(onAuthClosed({ kind: "logged_in" })).toBeUndefined();
    });
});

describe("a sign-in someone walked away from", () => {
    test("ends with a new sign-in, or a user", () => {
        expect(afterAbandoned({ kind: "logging_in" })).toBe("end");
        expect(afterAbandoned({ kind: "logged_in" })).toBe("end");
    });

    test("signs out an identity without an account it leaves behind, and waits for the rest", () => {
        expect(afterAbandoned({ kind: "registering" })).toBe("sign_out");
        expect(afterAbandoned({ kind: "loading_user", registering: true })).toBe("wait");
        expect(afterAbandoned({ kind: "anon" })).toBe("wait");
    });
});

describe("an identity without an account", () => {
    test("is one signed in without a user, or loading on the way to sign-up", () => {
        expect(withoutAccount({ kind: "registering" })).toBe(true);
        expect(withoutAccount({ kind: "loading_user", registering: true })).toBe(true);
        expect(withoutAccount({ kind: "loading_user", registering: false })).toBe(false);
        expect(withoutAccount({ kind: "logged_in" })).toBe(false);
    });
});

describe("the referral code a sign-up sends", () => {
    test("is the referrer the form names", () => {
        expect(referralCode("r1", "failed", false)).toBe("set");
    });

    test("is none once someone removed the referrer they saw or picked, or the link names no one", () => {
        expect(referralCode(undefined, "found", false)).toBe("clear");
        expect(referralCode(undefined, "failed", true)).toBe("clear");
        expect(referralCode(undefined, "none", false)).toBe("clear");
    });

    test("is the link's still when its lookup failed or hasn't finished", () => {
        expect(referralCode(undefined, "failed", false)).toBe("keep");
        expect(referralCode(undefined, "pending", false)).toBe("keep");
    });
});
