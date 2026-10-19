import { AuthProvider } from "@client";
import {
    afterAbandoned,
    authOptions,
    referralCode,
    nextAuthKind,
    onAuthClosed,
    showsSignedOut,
    uniqueWallets,
    withoutAccount,
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

describe("the Ethereum wallets", () => {
    test("are wagmi's connectors, one per name, with our icons for the configured ones", () => {
        expect(
            uniqueWallets([
                { id: "metaMaskSDK", name: "MetaMask" },
                { id: "walletConnect", name: "WalletConnect", icon: "data:wc" },
                // announced by the browser (EIP-6963)
                { id: "io.metamask", name: "MetaMask", icon: "data:mm" },
                { id: "io.rabby", name: "Rabby Wallet", icon: "data:rabby" },
            ]),
        ).toEqual([
            { id: "metaMaskSDK", name: "MetaMask", icon: "/assets/metamask.svg" },
            { id: "walletConnect", name: "WalletConnect", icon: "/assets/walletconnect.svg" },
            { id: "io.rabby", name: "Rabby Wallet", icon: "data:rabby" },
        ]);
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
