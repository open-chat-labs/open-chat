import { describe, expect, test } from "vitest";
import { resumedSignUpCredentialId, signsOutAsInterruptedSignUp } from "./signUpResume";

const passkey = { authPrincipal: "signing-up", credentialId: Uint8Array.from([1, 2]) };

describe("resumedSignUpCredentialId", () => {
    test("the stored passkey carries on the sign-up of the principal it was stored for", () => {
        expect(resumedSignUpCredentialId(passkey, "signing-up")).toBe(passkey.credentialId);
    });

    test("it's never sent for anyone else, nor when signed out", () => {
        expect(resumedSignUpCredentialId(passkey, "someone-else")).toBeUndefined();
        expect(resumedSignUpCredentialId(passkey, undefined)).toBeUndefined();
    });

    test("nothing stored, nothing to carry on", () => {
        expect(resumedSignUpCredentialId(undefined, "signing-up")).toBeUndefined();
    });
});

describe("signsOutAsInterruptedSignUp", () => {
    test("the session from before, with a sign-up passkey stored for it, is an interrupted sign-up", () => {
        expect(signsOutAsInterruptedSignUp(true, true)).toBe(true);
    });

    test("a session from before with no sign-up stored may have an account: no message", () => {
        expect(signsOutAsInterruptedSignUp(true, false)).toBe(false);
    });

    test("a sign-in going on now signs out as before", () => {
        expect(signsOutAsInterruptedSignUp(false, true)).toBe(false);
        expect(signsOutAsInterruptedSignUp(false, false)).toBe(false);
    });
});
