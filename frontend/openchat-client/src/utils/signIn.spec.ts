import { AuthProvider } from "@shared";
import { isOwnPrincipal, signInOptions } from "./signIn";

describe("signing in again accepts a linked principal and refuses any other", () => {
    const linked = async () => ["linked-principal"];

    test("accepts the principal the user is signed in with, and one linked to the account", async () => {
        expect(await isOwnPrincipal("current-principal", "current-principal", linked)).toBe(true);
        expect(await isOwnPrincipal("linked-principal", "current-principal", linked)).toBe(true);
    });

    test("refuses any other", async () => {
        expect(await isOwnPrincipal("someone-else", "current-principal", linked)).toBe(false);
    });
});

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
