import type { CreateOpenChatIdentityResponse, GetOpenChatIdentitySuccess } from "@shared";
import { describe, expect, test, vi } from "vitest";
import {
    openChatIdentityOrSignOut,
    signUpOpenChatIdentity,
    withoutOpenChatIdentity,
} from "./openChatIdentity";

const IDENTITY: GetOpenChatIdentitySuccess = {
    kind: "success",
    ocIdentityPrincipal: "oc-principal",
    ocIdentityExpiry: 1_000,
};

function creates(response: CreateOpenChatIdentityResponse) {
    return vi.fn(() => Promise.resolve(response));
}

describe("openChatIdentityOrSignOut", () => {
    test("an existing OpenChat identity is used without creating one or signing out", async () => {
        const create = creates(IDENTITY);
        const signOut = vi.fn();

        expect(await openChatIdentityOrSignOut(IDENTITY, create, signOut)).toBe(IDENTITY);
        expect(create).not.toHaveBeenCalled();
        expect(signOut).not.toHaveBeenCalled();
    });

    test("a missing OpenChat identity is created", async () => {
        const create = creates(IDENTITY);
        const signOut = vi.fn();

        const result = await openChatIdentityOrSignOut(
            { kind: "oc_identity_not_found" },
            create,
            signOut,
        );

        expect(result).toBe(IDENTITY);
        expect(create).toHaveBeenCalledOnce();
        expect(signOut).not.toHaveBeenCalled();
    });

    // Invariants 1 and 2 of #9635: without an OpenChat identity no identity is returned, so the
    // user is never loaded and registration never shown, and the sign-in ends signed out.
    test.each([
        "already_registered",
        "public_key_invalid",
        "originating_canister_invalid",
    ] as const)(
        "a failed creation (%s) signs out with the failure and returns no identity",
        async (failure) => {
            const signOut = vi.fn();

            const result = await openChatIdentityOrSignOut(
                { kind: "oc_identity_not_found" },
                creates(failure),
                signOut,
            );

            expect(result).toBeUndefined();
            expect(signOut).toHaveBeenCalledExactlyOnceWith(`createOpenChatIdentity: ${failure}`);
        },
    );

    test("a rejected creation signs out with the error and returns no identity", async () => {
        const signOut = vi.fn();

        const result = await openChatIdentityOrSignOut(
            { kind: "oc_identity_not_found" },
            () => Promise.reject(new Error("Delegation not found")),
            signOut,
        );

        expect(result).toBeUndefined();
        expect(signOut).toHaveBeenCalledExactlyOnceWith(
            "createOpenChatIdentity: error: Error: Delegation not found",
        );
    });

    test("any other setAuthIdentity answer signs out without trying to create an identity", async () => {
        const create = creates(IDENTITY);
        const signOut = vi.fn();

        const result = await openChatIdentityOrSignOut(
            { kind: "auth_identity_not_found" },
            create,
            signOut,
        );

        expect(result).toBeUndefined();
        expect(create).not.toHaveBeenCalled();
        expect(signOut).toHaveBeenCalledExactlyOnceWith("setAuthIdentity: auth_identity_not_found");
    });
});

// #10580: a sign-up ends signed in or says why; it never leaves the person signed out on the
// landing page without a word
describe("withoutOpenChatIdentity", () => {
    test("a sign-in without an OpenChat identity signs out", () => {
        expect(withoutOpenChatIdentity(false)).toBe("sign_out");
    });

    test("a passkey sign-up keeps its identity, so the sign-up can fail and try again", () => {
        expect(withoutOpenChatIdentity(true)).toBe("keep_for_sign_up");
    });
});

describe("signUpOpenChatIdentity", () => {
    test("with an OpenChat identity, the account is asked for", () => {
        expect(signUpOpenChatIdentity(true, true)).toBe("register");
        expect(signUpOpenChatIdentity(true, false)).toBe("register");
    });

    test("without one, the try that just made the passkey fails: its load already tried", () => {
        expect(signUpOpenChatIdentity(false, true)).toBe("failed");
    });

    test("without one, a later try makes it again with the same passkey", () => {
        expect(signUpOpenChatIdentity(false, false)).toBe("make_again");
    });
});
