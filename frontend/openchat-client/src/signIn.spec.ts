import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// A store the client builds at import time reads the screen width through
// matchMedia, which jsdom does not provide
vi.hoisted(() => {
    window.matchMedia = ((query: string) =>
        ({
            matches: false,
            media: query,
            addEventListener: () => {},
            removeEventListener: () => {},
            addListener: () => {},
            removeListener: () => {},
            onchange: null,
            dispatchEvent: () => false,
        }) as unknown as MediaQueryList) as typeof window.matchMedia;
});

// The auth client's window: each test says how it ends
const authWindow = vi.hoisted(() => ({
    end: (_callbacks: { onSuccess: () => void; onError: (err: string) => void }) => {},
}));
vi.mock("@icp-sdk/auth/client", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    AuthClient: {
        create: async () => ({
            login: (callbacks: { onSuccess: () => void; onError: (err: string) => void }) =>
                authWindow.end(callbacks),
        }),
    },
}));

import { AuthProvider, IdentityStorage, type IdentityState } from "@shared";
import type { OpenChat as OpenChatType } from "./openchat";
import type { OpenChatConfig } from "./config";
import { OpenChat } from "./openchat";
import { identityStateStore, selectedAuthProviderStore } from "./state";

class FakeWorker {
    onmessage: ((ev: MessageEvent) => void) | undefined;
    postMessage() {}
    addEventListener() {}
}

function config(): OpenChatConfig {
    return {
        mobileLayout: "v1",
        websiteVersion: "test",
        logger: { error: vi.fn(), debug: vi.fn(), warn: vi.fn(), log: vi.fn() },
        proposalBotCanister: "aaaaa-aa",
    } as unknown as OpenChatConfig;
}

const set = (state: IdentityState) => identityStateStore.set(state);

describe("signing in", () => {
    let client: OpenChatType;

    beforeEach(async () => {
        vi.stubGlobal("Worker", FakeWorker);
        // the stored identity the client starts from, which jsdom has no IndexedDB to hold
        vi.spyOn(IdentityStorage.prototype, "getKeyAndChain").mockResolvedValue(undefined);
        client = new OpenChat(config());
        // let the client finish starting as anonymous before each sign-in
        await new Promise((r) => setTimeout(r, 0));
        set({ kind: "anon" });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        set({ kind: "anon" });
    });

    // a passkey sign-in whose identity loads to `state`, as #loadedAuthenticationIdentity leaves it
    function passkeyLoadsTo(state: IdentityState) {
        return vi.spyOn(client, "signInWithWebAuthn").mockImplementation(async () => set(state));
    }

    /** Invariant 2: needs_account only for an identity without an account (registering); a user is
     * logged_in; an identity that didn't load (no OpenChat identity, so signed out) fails. */
    test("settles with where the identity got to", async () => {
        passkeyLoadsTo({ kind: "logged_in" });
        expect(await client.signIn({ kind: "passkey" })).toEqual({ kind: "logged_in" });

        passkeyLoadsTo({ kind: "registering" });
        expect(await client.signIn({ kind: "passkey" })).toEqual({ kind: "needs_account" });

        passkeyLoadsTo({ kind: "anon" });
        expect((await client.signIn({ kind: "passkey" })).kind).toBe("failed");
        expect(selectedAuthProviderStore.value).toBe(AuthProvider.PASSKEY);
    });

    /** Invariant 1: a dismissed passkey prompt (or one OpenChat doesn't know) is cancelled, so the
     * choices come back; the native credential manager failing outright is a failure to show. */
    test("a declined passkey is cancelled; a native auth failure fails", async () => {
        vi.spyOn(client, "signInWithWebAuthn").mockRejectedValue(new Error("NotAllowedError"));
        expect(await client.signIn({ kind: "passkey" })).toEqual({ kind: "cancelled" });

        vi.spyOn(client, "isNativeApp").mockReturnValue(true);
        vi.spyOn(client, "signInWithAndroidWebAuthn").mockRejectedValue("AUTH_FAILED");
        const outcome = await client.signIn({ kind: "passkey" });
        expect(outcome.kind === "failed" && outcome.reason.key).toBe("native.auth.errors.default");
    });

    /** Invariant 2: an identity whose load failed (once the prompt was through) fails, rather
     * than looking like a dismissed prompt. */
    test("a passkey whose identity can't be loaded fails", async () => {
        const logError = vi.spyOn(client, "logError").mockImplementation(() => {});
        vi.spyOn(client, "signInWithWebAuthn").mockImplementation(async () => {
            set({ kind: "loading_user", registering: false });
            throw new Error("worker gone");
        });
        expect((await client.signIn({ kind: "passkey" })).kind).toBe("failed");
        expect(logError).toHaveBeenCalledOnce();
    });

    /** Invariant 3: the native app uses its own passkeys, the browser its WebAuthn. */
    test("the passkey is the native app's in the app, the browser's otherwise", async () => {
        const web = passkeyLoadsTo({ kind: "logged_in" });
        const native = vi
            .spyOn(client, "signInWithAndroidWebAuthn")
            .mockImplementation(async () => (set({ kind: "logged_in" }), [] as never));
        await client.signIn({ kind: "passkey" });
        expect(web).toHaveBeenCalledOnce();
        expect(native).not.toHaveBeenCalled();

        vi.spyOn(client, "isNativeApp").mockReturnValue(true);
        await client.signIn({ kind: "passkey" });
        expect(native).toHaveBeenCalledOnce();
        expect(web).toHaveBeenCalledOnce();
    });

    /** Invariant 1: the auth client's window closed is cancelled, back to anonymous. */
    test("a closed Internet Identity window is cancelled", async () => {
        authWindow.end = ({ onError }) => onError("UserInterrupt");
        vi.spyOn(console, "warn").mockImplementation(() => {});
        expect(await client.signIn({ kind: "auth_client", provider: "ii" })).toEqual({
            kind: "cancelled",
        });
        expect(identityStateStore.value.kind).toBe("anon");
        expect(selectedAuthProviderStore.value).toBe(AuthProvider.II);
    });

    /** Invariant 4: a sign-in given up settles cancelled, even if its identity goes on to load. */
    test("given up, it's cancelled whatever the identity comes to", async () => {
        let finish!: () => void;
        vi.spyOn(client, "signInWithWebAuthn").mockImplementation(
            () => new Promise<void>((r) => (finish = () => (set({ kind: "logged_in" }), r()))),
        );
        const walkedAway = new AbortController();
        const outcome = client.signIn({ kind: "passkey" }, walkedAway.signal);
        walkedAway.abort();
        expect(await outcome).toEqual({ kind: "cancelled" });
        finish();

        const already = new AbortController();
        already.abort();
        expect(await client.signIn({ kind: "passkey" }, already.signal)).toEqual({
            kind: "cancelled",
        });
    });

    test("a wallet the backend won't sign in fails", async () => {
        vi.spyOn(client, "signInWithWallet").mockResolvedValue({ kind: "failure" });
        const outcome = await client.signIn({
            kind: "wallet",
            token: "eth",
            address: "0xabc",
            signature: "0xsig",
        });
        expect(outcome.kind).toBe("failed");
        expect(selectedAuthProviderStore.value).toBe(AuthProvider.ETH);
    });

    describe("by an emailed link", () => {
        const sent = { kind: "success", code: "123", userKey: new Uint8Array(), expiration: 1n };
        let polls: ReturnType<typeof vi.fn>;

        beforeEach(() => {
            vi.useFakeTimers({
                toFake: ["setTimeout", "setInterval", "clearTimeout", "clearInterval"],
            });
            vi.spyOn(console, "debug").mockImplementation(() => {});
            vi.spyOn(client, "gaTrack").mockImplementation(() => {});
            polls = vi.fn(async () => ({ kind: "not_found" }));
            vi.spyOn(client, "getSignInWithEmailDelegation").mockImplementation(polls as never);
        });
        afterEach(() => vi.useRealTimers());

        /** Invariant 5: a link that couldn't be sent says why, and nothing is waited for. */
        test("a link that couldn't be sent fails with the reason, and isn't waited for", async () => {
            vi.spyOn(client, "generateMagicLink").mockResolvedValue({ kind: "email_invalid" });
            const resp = await client.requestEmailSignIn("bad");
            expect(resp.kind === "failed" && resp.reason.key).toBe("loginDialog.invalidEmail");
            await vi.advanceTimersByTimeAsync(5000);
            expect(polls).not.toHaveBeenCalled();
            expect(selectedAuthProviderStore.value).toBe(AuthProvider.EMAIL);
        });

        /** Invariant 6: once the link is followed, the sign-in settles with where the identity got
         * to, and the checking stops. */
        test("sent, it signs in once the link is followed, and stops checking", async () => {
            vi.spyOn(client, "generateMagicLink").mockResolvedValue(sent as never);
            const resp = await client.requestEmailSignIn("me@example.com");
            if (resp.kind !== "sent") throw new Error(resp.kind);
            expect(resp.code).toBe("123");
            await vi.advanceTimersByTimeAsync(2500);
            expect(polls).toHaveBeenCalled();
            polls.mockImplementation(async () => {
                set({ kind: "registering" });
                return { kind: "success" };
            });
            await vi.advanceTimersByTimeAsync(1000);
            expect(await resp.signedIn).toEqual({ kind: "needs_account" });
            const checks = polls.mock.calls.length;
            await vi.advanceTimersByTimeAsync(5000);
            expect(polls.mock.calls.length).toBe(checks);
        });

        /** Invariant 7: given up, a sent link settles cancelled and stops being checked; given up
         * while it's being sent, it's cancelled and never checked. */
        test("given up, the link is cancelled and no longer checked", async () => {
            vi.spyOn(client, "generateMagicLink").mockResolvedValue(sent as never);
            const walkedAway = new AbortController();
            const resp = await client.requestEmailSignIn("me@example.com", walkedAway.signal);
            if (resp.kind !== "sent") throw new Error(resp.kind);
            walkedAway.abort();
            expect(await resp.signedIn).toEqual({ kind: "cancelled" });
            await vi.advanceTimersByTimeAsync(5000);
            expect(polls).not.toHaveBeenCalled();

            const closed = new AbortController();
            vi.spyOn(client, "generateMagicLink").mockImplementation(async () => {
                closed.abort();
                return sent as never;
            });
            expect(await client.requestEmailSignIn("me@example.com", closed.signal)).toEqual({
                kind: "cancelled",
            });
            await vi.advanceTimersByTimeAsync(5000);
            expect(polls).not.toHaveBeenCalled();
        });
    });

    describe("signing up", () => {
        const success = { kind: "success", userId: "u1", icpAccount: "acc" } as const;
        let register: ReturnType<typeof vi.fn>;
        let passkey: ReturnType<typeof vi.fn>;
        let handedOver: ReturnType<typeof vi.fn>;

        beforeEach(() => {
            register = vi.fn(async () => success);
            vi.spyOn(client, "registerUser").mockImplementation(register as never);
            // a passkey whose identity has no account yet
            passkey = vi.fn(async () => set({ kind: "registering" }));
            vi.spyOn(client, "signUpWithWebAuthn").mockImplementation(passkey as never);
            handedOver = vi.fn();
            vi.spyOn(client, "onRegisteredUser").mockImplementation(handedOver as never);
        });

        test("makes a passkey, then the account, and hands the user to the client", async () => {
            expect(await client.signUp("newperson", "me@example.com", true)).toEqual({
                kind: "success",
            });
            expect(passkey).toHaveBeenCalledWith(true, "newperson");
            expect(register).toHaveBeenCalledWith("newperson", "me@example.com");
            expect(handedOver).toHaveBeenCalledWith(
                expect.objectContaining({ username: "newperson", userId: "u1" }),
            );
        });

        /** Invariant 11: no passkey and no account unless the person agreed to the terms. */
        test("without the terms agreed to, nothing is made", async () => {
            set({ kind: "anon" });
            expect((await client.signUp("newperson", undefined, false)).kind).toBe("failed");
            expect(passkey).not.toHaveBeenCalled();
            expect(register).not.toHaveBeenCalled();
        });

        test("an identity without an account only needs the account", async () => {
            set({ kind: "registering" });
            await client.signUp("newperson", undefined, true);
            expect(passkey).not.toHaveBeenCalled();
            expect(register).toHaveBeenCalledOnce();
        });

        /** Invariant 8: one sign-up never makes a second passkey, even when the first left no
         * identity to make the account with. */
        test("never makes a second passkey", async () => {
            // no OpenChat identity for the passkey, so it's signed out
            passkey.mockImplementation(async () => set({ kind: "anon" }));
            expect((await client.signUp("newperson", undefined, true)).kind).toBe("failed");
            expect((await client.signUp("newperson", undefined, true)).kind).toBe("failed");
            expect(passkey).toHaveBeenCalledOnce();
            expect(register).not.toHaveBeenCalled();
        });

        /** Invariant 8: a passkey made whose identity then failed to load isn't made again; the
         * next try goes on to the account with the identity it has. */
        test("a passkey made but not loaded isn't made again", async () => {
            vi.spyOn(client, "logError").mockImplementation(() => {});
            passkey.mockImplementation(async () => {
                set({ kind: "loading_user", registering: true });
                throw new Error("worker gone");
            });
            expect((await client.signUp("newperson", undefined, true)).kind).toBe("failed");
            expect(register).not.toHaveBeenCalled();
            expect(await client.signUp("newperson", undefined, true)).toEqual({ kind: "success" });
            expect(passkey).toHaveBeenCalledOnce();
            expect(register).toHaveBeenCalledOnce();
        });

        test("a dismissed passkey prompt is cancelled, and the next try asks again", async () => {
            passkey.mockRejectedValueOnce(new Error("NotAllowedError"));
            expect(await client.signUp("newperson", undefined, true)).toEqual({
                kind: "cancelled",
            });
            expect(register).not.toHaveBeenCalled();
            expect(await client.signUp("newperson", undefined, true)).toEqual({ kind: "success" });
            expect(passkey).toHaveBeenCalledTimes(2);
        });

        /** Invariant 9: a sign-up given up before the account is asked for makes no account. */
        test("given up after its passkey, it makes no account", async () => {
            const closed = new AbortController();
            passkey.mockImplementation(async () => {
                set({ kind: "registering" });
                closed.abort();
            });
            expect(await client.signUp("newperson", undefined, true, closed.signal)).toEqual({
                kind: "cancelled",
            });
            expect(register).not.toHaveBeenCalled();
        });

        /** Invariant 10: a referral code the backend turned down is never sent again, so the next
         * try goes ahead without it. */
        test("a refused referral code isn't sent again", async () => {
            set({ kind: "registering" });
            const clear = vi.spyOn(client, "clearReferralCode");
            client.setReferralCode("r1");
            // as registerUser does, the refused code is cleared once it's turned down
            register.mockImplementationOnce(async () => {
                client.clearReferralCode();
                return { kind: "referral_code_invalid" };
            });
            const refused = await client.signUp("newperson", undefined, true);
            expect(refused.kind === "referral_refused" && refused.reason.key).toBe(
                "register.referralCodeInvalid",
            );
            // the form still has the referrer, and sets it again
            client.setReferralCode("r1");
            clear.mockClear();
            expect(await client.signUp("newperson", undefined, true)).toEqual({ kind: "success" });
            expect(clear.mock.invocationCallOrder[0]).toBeLessThan(
                register.mock.invocationCallOrder[1],
            );
            expect(await client.getReferringUser()).toBeUndefined();
        });

        test("a refused account says why in the app's words", async () => {
            set({ kind: "registering" });
            register.mockResolvedValueOnce({ kind: "username_taken" });
            const outcome = await client.signUp("taken1", undefined, true);
            expect(outcome.kind === "failed" && outcome.reason.key).toBe("register.usernameTaken");
            expect(handedOver).not.toHaveBeenCalled();
        });
    });
});
