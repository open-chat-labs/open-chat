import { describe, expect, test } from "vitest";
import { resumedSignUpCredentialId, withoutOpenChatIdentity } from "./signUpResume";

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

describe("withoutOpenChatIdentity", () => {
    test("the session from before is an interrupted sign-up, which says why it's signed out", () => {
        expect(withoutOpenChatIdentity(true)).toBe("sign_up_interrupted");
    });

    test("a sign-in going on now signs out as before", () => {
        expect(withoutOpenChatIdentity(false)).toBe("sign_out");
    });
});
