import { AuthProvider } from "@client";
import {
    afterClosedSignup,
    authOptions,
    nextAuthKind,
    onAuthClosed,
    onAuthLeft,
    registerFailureKey,
    showsSignedOut,
} from "./auth.adapter";

describe("the sign-in options", () => {
    test("are all of them by default, and only email without WebAuthn", () => {
        expect(authOptions([], true)).toEqual(["passkey", "email", "ii", "eth", "sol", "nfid"]);
        expect(authOptions([], false)).toEqual(["email"]);
        // nor does the last method used bring passkey back
        expect(authOptions([], false, AuthProvider.PASSKEY)).toEqual(["email"]);
    });

    test("?auth= narrows them, by the old names or AuthProvider's", () => {
        expect(authOptions(["II", "EMAIL"], true)).toEqual(["email", "ii"]);
        expect(authOptions([AuthProvider.ETH], true)).toEqual(["eth"]);
        expect(authOptions(["SOL"], false)).toEqual([]);
    });
});

describe("the sign-in options on a link's page", () => {
    test("a bare ?auth (the emailed link's URL) narrows nothing", () => {
        expect(authOptions([""], true)).toEqual(authOptions([], true));
        expect(authOptions(["", "II"], true)).toEqual(["ii"]);
    });
});

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

describe("the sign-in options' order", () => {
    test("puts the method last signed in with first", () => {
        expect(authOptions([], true, AuthProvider.SOL)).toEqual([
            "sol",
            "passkey",
            "email",
            "ii",
            "eth",
            "nfid",
        ]);
        expect(authOptions(["II", "ETH"], true, AuthProvider.ETH)).toEqual(["eth", "ii"]);
    });

    test("a last method that isn't on offer changes nothing", () => {
        expect(authOptions(["II"], true, AuthProvider.SOL)).toEqual(["ii"]);
    });
});

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

describe("closing the in-app dialog", () => {
    test("gives up a sign-in, and signs out an identity without an account", () => {
        expect(onAuthClosed({ kind: "logging_in" })).toBe("anon");
        expect(onAuthClosed({ kind: "registering" })).toBe("sign_out");
    });

    test("leaves a signed-in or anonymous identity as it is", () => {
        expect(onAuthClosed({ kind: "anon" })).toBeUndefined();
        expect(onAuthClosed({ kind: "logged_in" })).toBeUndefined();
        expect(onAuthClosed({ kind: "loading_user", registering: false })).toBeUndefined();
    });

    test("mid sign-up, while the user loads, signs out once it has instead of opening again", () => {
        expect(onAuthClosed({ kind: "loading_user", registering: true })).toBe(
            "sign_out_once_loaded",
        );
        expect(afterClosedSignup({ kind: "loading_user", registering: true })).toBe("wait");
        expect(afterClosedSignup({ kind: "registering" })).toBe("sign_out");
        expect(afterClosedSignup({ kind: "logged_in" })).toBe("done");
        expect(afterClosedSignup({ kind: "anon" })).toBe("done");
    });
});

describe("leaving the app with its dialog open", () => {
    test("gives up a sign-in, so / shows Landing again", () => {
        expect(onAuthLeft({ kind: "logging_in" })).toBe("anon");
    });

    test("keeps an identity without an account for the sign-up form", () => {
        expect(onAuthLeft({ kind: "registering" })).toBeUndefined();
        expect(onAuthLeft({ kind: "logged_in" })).toBeUndefined();
    });
});
