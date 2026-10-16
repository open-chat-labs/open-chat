import { AuthProvider } from "@client";
import { authOptions, nextAuthKind } from "./auth.adapter";

describe("the sign-in options", () => {
    test("are all of them by default, and only passkey and email without WebAuthn", () => {
        expect(authOptions([], true)).toEqual(["passkey", "email", "ii", "eth", "sol", "nfid"]);
        expect(authOptions([], false)).toEqual(["passkey", "email"]);
    });

    test("?auth= narrows them, by the old names or AuthProvider's", () => {
        expect(authOptions(["II", "EMAIL"], true)).toEqual(["email", "ii"]);
        expect(authOptions([AuthProvider.ETH], true)).toEqual(["eth"]);
        expect(authOptions(["SOL"], false)).toEqual([]);
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
