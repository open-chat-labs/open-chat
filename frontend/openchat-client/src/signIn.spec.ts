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
});
