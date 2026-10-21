import { AuthProvider } from "@shared";
import { signInOptions } from "./signIn";

const { EMAIL, PASSKEY, II, ETH, SOL, NFID } = AuthProvider;
const browser = { webAuthn: true, native: false };

describe("the sign-in options", () => {
    test("are all of them with WebAuthn", () => {
        expect(signInOptions([], browser)).toEqual([EMAIL, PASSKEY, II, ETH, SOL, NFID]);
    });

    test("without WebAuthn are email, plus a passkey and Internet Identity in the native app", () => {
        expect(signInOptions([], { webAuthn: false, native: false })).toEqual([EMAIL]);
        expect(signInOptions([], { webAuthn: false, native: false }, PASSKEY)).toEqual([EMAIL]);
        expect(signInOptions([], { webAuthn: false, native: true })).toEqual([EMAIL, PASSKEY, II]);
    });

    test("?auth= narrows them, by the old names or AuthProvider's", () => {
        expect(signInOptions(["II", "EMAIL"], browser)).toEqual([EMAIL, II]);
        expect(signInOptions(new Set([ETH]), browser)).toEqual([ETH]);
    });

    test("a bare ?auth (the emailed link's URL) narrows nothing", () => {
        expect(signInOptions([""], browser)).toEqual(signInOptions([], browser));
        expect(signInOptions(["", "II"], browser)).toEqual([II]);
    });

    test("put the method last signed in with first, if it's on offer", () => {
        expect(signInOptions([], browser, SOL)).toEqual([SOL, EMAIL, PASSKEY, II, ETH, NFID]);
        expect(signInOptions(["II"], browser, SOL)).toEqual([II]);
    });
});
