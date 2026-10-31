import { AuthProvider, ErrorCode } from "@shared";
import {
    isOwnPrincipal,
    linkedPrincipalProvider,
    linkedSignInProviders,
    linkIdentitiesResult,
    markCurrentSignIn,
    shortSignInPrincipal,
    signInLastUsed,
    signInOptions,
    unlinkIdentityFailure,
} from "./signIn";

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

describe("a linked principal's provider", () => {
    const canisters = { ethereum: "eth", solana: "sol", email: "email", internetIdentity: "ii" };
    const provider = (originatingCanister: string, isIIPrincipal = false) =>
        linkedPrincipalProvider({ originatingCanister, isIIPrincipal }, canisters);

    test("comes from the canister it originated from", () => {
        expect(provider("zzzxd-webau-thnke-yr7oc-cai")).toBe(PASSKEY);
        expect(provider("eth")).toBe(ETH);
        expect(provider("sol")).toBe(SOL);
        expect(provider("email")).toBe(EMAIL);
    });

    test("tells Internet Identity from NFID, which both originate from the II canister", () => {
        expect(provider("ii", true)).toBe(II);
        expect(provider("ii", false)).toBe(NFID);
    });

    /** Invariant: an NFID canister of its own (NFID Wallet's) is NFID, not Internet Identity,
     * which could only ever give the user a different principal. */
    test("is NFID from any other canister", () => {
        expect(provider("yak5f-6iaaa-aaaal-ajn2a-cai")).toBe(NFID);
    });
});

describe("the ways to sign in again", () => {
    const linked = (...providers: AuthProvider[]) => providers.map((provider) => ({ provider }));

    test("are the methods linked to the account", () => {
        expect(linkedSignInProviders(linked(EMAIL, PASSKEY, PASSKEY), browser)).toEqual(
            new Set([EMAIL, PASSKEY]),
        );
    });

    test("don't include NFID for an Internet Identity", () => {
        expect(linkedSignInProviders(linked(II), browser)).toEqual(new Set([II]));
    });

    /** Invariant: an Internet Identity labelled NFID can still be used. */
    test("include Internet Identity for NFID, which it may really be", () => {
        expect(linkedSignInProviders(linked(NFID), browser)).toEqual(new Set([NFID, II]));
    });

    test("restrict the sign-in options, offering all of them when there are none", () => {
        const options = (...providers: AuthProvider[]) =>
            signInOptions(linkedSignInProviders(linked(...providers), browser), browser, II);
        expect(options(ETH, EMAIL)).toEqual([EMAIL, ETH]);
        expect(options()).toHaveLength(6);
    });

    /** Invariant: the user is never left with nothing to pick. */
    test("are all of them when this platform has none of those linked", () => {
        const native = { webAuthn: false, native: true };
        expect(signInOptions(linkedSignInProviders(linked(ETH, SOL), native), native)).toEqual([
            EMAIL,
            PASSKEY,
            II,
        ]);
    });
});

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

describe("unlinking a sign-in method", () => {
    test("is fine when it unlinks", () => {
        expect(unlinkIdentityFailure("success")).toBeUndefined();
    });

    test("says why it couldn't, the one in use among them", () => {
        expect(unlinkIdentityFailure("cannot_unlink_active_principal")?.key).toBe(
            "identity.failure.unlinkActivePrincipal",
        );
        expect(unlinkIdentityFailure("identity_link_not_found")?.key).toBe(
            "identity.failure.identityNotFound",
        );
    });
});

describe("the sign-in method this session used", () => {
    const passkey = (principal: string, id: number[], current = false) => ({
        principal,
        originatingCanister: "c",
        isIIPrincipal: false,
        isCurrentIdentity: current,
        webAuthnKey: {
            publicKey: new Uint8Array(),
            credentialId: new Uint8Array(id),
            origin: "o",
            crossPlatform: false,
            aaguid: new Uint8Array(),
        },
        lastUsed: undefined,
    });

    test("is the passkey whose credential the session used, which the backend can't tell", () => {
        const marked = markCurrentSignIn(
            [passkey("a", [1, 2]), passkey("b", [3, 4])],
            new Uint8Array([3, 4]),
        );
        expect(marked.map((p) => [p.principal, p.isCurrentIdentity])).toEqual([
            ["a", false],
            ["b", true],
        ]);
    });

    test("is only that passkey, even if the backend marked another", () => {
        const marked = markCurrentSignIn(
            [passkey("a", [1], true), passkey("b", [2])],
            new Uint8Array([2]),
        );
        expect(marked.map((p) => p.isCurrentIdentity)).toEqual([false, true]);
    });

    test("stays the one the backend marked, and is none without a passkey session", () => {
        const marked = markCurrentSignIn([passkey("a", [1], true), passkey("b", [2])], undefined);
        expect(marked.map((p) => p.isCurrentIdentity)).toEqual([true, false]);
    });
});

describe("linking a sign-in method", () => {
    const error = (code: ErrorCode) => ({ kind: "error" as const, code, message: undefined });

    test("links", () => {
        expect(linkIdentitiesResult("success")).toEqual({ kind: "linked" });
        expect(linkIdentitiesResult({ kind: "success" })).toEqual({ kind: "linked" });
    });

    test("an identity already linked to another account says so, and starts over", () => {
        for (const resp of ["already_registered" as const, error(ErrorCode.PrincipalAlreadyUsed)]) {
            const result = linkIdentitiesResult(resp);
            expect(result).toMatchObject({ kind: "failed", startOver: true });
            expect(result.kind === "failed" && result.reason.key).toBe(
                "identity.failure.alreadyLinked",
            );
        }
    });

    test("one already linked to this account doesn't start over", () => {
        expect(linkIdentitiesResult("already_linked_to_principal")).toMatchObject({
            kind: "failed",
            startOver: false,
        });
    });

    test("says when the account has as many methods as it can", () => {
        for (const resp of [
            "linked_identities_limit_reached" as const,
            error(ErrorCode.MaxLinkedIdentitiesLimitReached),
        ]) {
            const result = linkIdentitiesResult(resp);
            expect(result.kind === "failed" && result.reason.key).toBe(
                "identity.failure.limitReached",
            );
        }
    });
});

describe("a sign-in method's last used line", () => {
    test("is the day it was last used, in the locale", () => {
        // midday UTC, so 12 Oct in any time zone within 12 hours of UTC
        const key = signInLastUsed(1_760_270_400_000n, "en-GB");
        expect(key.key).toBe("identity.linkedAccounts.lastUsed");
        expect(key.params).toEqual({ date: "12 Oct 2025" });
    });
});

describe("a sign-in method's principal", () => {
    test("keeps only its first and last groups", () => {
        expect(
            shortSignInPrincipal("7z6fx-jpbwz-amxwd-ngxyp-a3d4t-gqtxc-ehwxl-5s4ut-ouvzm-4pv7u-wae"),
        ).toBe("7z6fx-...-wae");
    });

    test("is left whole when it has no middle groups", () => {
        expect(shortSignInPrincipal("2vxsx-fae")).toBe("2vxsx-fae");
    });
});
