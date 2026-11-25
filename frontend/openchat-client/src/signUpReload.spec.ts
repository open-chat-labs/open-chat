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

// The auth client keeps its keys in IndexedDB, which jsdom doesn't have
vi.mock("@icp-sdk/auth/client", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    AuthClient: { create: async () => ({ logout: async () => {} }) },
}));

import { IdbStorage } from "@icp-sdk/auth/client";
import { DelegationChain, ECDSAKeyIdentity } from "@icp-sdk/core/identity";
import {
    getSignUpPasskey,
    IdentityStorage,
    storeSignUpInterrupted,
    storeSignUpPasskey,
    type IdentityKeyAndChain,
} from "@shared";
import type { OpenChatConfig } from "./config";
import { OpenChat } from "./openchat";
import { identityStateStore, signUpInterruptedStore } from "./state";

// What the client asks the worker for, by kind
type Request = {
    kind: string;
    correlationId: number;
    webAuthnCredentialId?: Uint8Array;
};
const posted: Request[] = [];

// The identity canister as it is after a passkey was made and before the reload: no OpenChat
// identity for its principal, and one can only be created with the passkey's credential id
// (without it the canister can't check the passkey: originating_canister_invalid)
class FakeWorker {
    onmessage: ((ev: MessageEvent) => void) | undefined;
    postMessage(msg: Request) {
        posted.push(msg);
        if (msg.kind === "setAuthIdentity") {
            this.answer(msg, { kind: "oc_identity_not_found" });
        }
        if (msg.kind === "createOpenChatIdentity") {
            this.answer(
                msg,
                msg.webAuthnCredentialId === undefined
                    ? "originating_canister_invalid"
                    : {
                          kind: "success",
                          ocIdentityPrincipal: "oc",
                          ocIdentityExpiry: Date.now() + 3_600_000,
                      },
            );
        }
        if (msg.kind === "getCurrentUser") this.answer(msg, { kind: "unknown_user" });
    }
    answer(msg: Request, response: unknown) {
        const data = {
            kind: "worker_response",
            requestKind: msg.kind,
            correlationId: msg.correlationId,
            response,
            final: true,
        };
        void Promise.resolve().then(() => this.onmessage?.({ data } as MessageEvent));
    }
    addEventListener() {}
}

function config(): OpenChatConfig {
    return {
        mobileLayout: "v1",
        websiteVersion: "test",
        logger: { error: vi.fn(), debug: vi.fn(), warn: vi.fn(), log: vi.fn() },
        proposalBotCanister: "aaaaa-aa",
        webAuthnOrigin: "oc.app",
    } as unknown as OpenChatConfig;
}

// The auth client's storage (auth-client-db), in memory
const stored = new Map<string, unknown>();
const storage = new IdbStorage();

// A session a passkey sign-up stored: a delegation from the passkey (an ECDSA key stands in for
// it here) to the session key. Its principal is the passkey's.
async function passkeySession(): Promise<{ session: IdentityKeyAndChain; principal: string }> {
    const passkey = await ECDSAKeyIdentity.generate();
    const key = await ECDSAKeyIdentity.generate();
    const delegation = await DelegationChain.create(
        passkey,
        key.getPublicKey(),
        new Date(Date.now() + 60_000),
    );
    return { session: { key, delegation }, principal: passkey.getPrincipal().toString() };
}

const created = () => posted.filter((m) => m.kind === "createOpenChatIdentity");

describe("a reload partway through passkey sign-up (#10596)", () => {
    let logout: ReturnType<typeof vi.fn<() => Promise<void>>>;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.stubGlobal("Worker", FakeWorker);
        posted.length = 0;
        stored.clear();
        vi.spyOn(IdbStorage.prototype, "get").mockImplementation(
            async (key: string) => (stored.get(key) ?? null) as never,
        );
        vi.spyOn(IdbStorage.prototype, "set").mockImplementation(async (key, value) => {
            stored.set(key, value);
        });
        vi.spyOn(IdbStorage.prototype, "remove").mockImplementation(async (key) => {
            stored.delete(key);
        });
        logout = vi.fn<() => Promise<void>>(async () => {});
        vi.spyOn(OpenChat.prototype, "logout").mockImplementation(logout);
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        identityStateStore.set({ kind: "anon" });
        signUpInterruptedStore.set(false);
    });

    async function startWith(session: IdentityKeyAndChain | undefined): Promise<void> {
        vi.spyOn(IdentityStorage.prototype, "getKeyAndChain").mockResolvedValue(session);
        new OpenChat(config());
        await vi.advanceTimersByTimeAsync(0);
    }

    /** Invariant 1: the passkey made before the reload creates the OpenChat identity, and the
     * sign-up goes on to the form (registering) without another passkey. */
    test("carries the sign-up on with the passkey stored for its principal", async () => {
        const { session, principal } = await passkeySession();
        const credentialId = Uint8Array.from([1, 2, 3]);
        await storeSignUpPasskey(storage, { authPrincipal: principal, credentialId });

        await startWith(session);

        expect(created()).toHaveLength(1);
        expect(Array.from(created()[0].webAuthnCredentialId ?? [])).toEqual([1, 2, 3]);
        expect(identityStateStore.value.kind).toBe("registering");
        expect(logout).not.toHaveBeenCalled();
        expect(signUpInterruptedStore.value).toBe(false);
    });

    /** Invariant 2: a sign-up that can't be carried on is signed out, saying why on the page after
     * the sign-out's navigation. */
    test("a session with no passkey stored for it is signed out as an interrupted sign-up", async () => {
        const { session } = await passkeySession();

        await startWith(session);

        expect(created()).toHaveLength(1);
        expect(created()[0].webAuthnCredentialId).toBeUndefined();
        expect(logout).toHaveBeenCalledOnce();

        // the page the sign-out navigates to
        await startWith(undefined);
        expect(signUpInterruptedStore.value).toBe(true);
    });

    test("says so once", async () => {
        await storeSignUpInterrupted(storage);
        await startWith(undefined);
        expect(signUpInterruptedStore.value).toBe(true);

        signUpInterruptedStore.set(false);
        await startWith(undefined);
        expect(signUpInterruptedStore.value).toBe(false);
    });

    /** Invariant 2: the passkey's details stored, but its delegation gone (expired, or the reload
     * came before it was stored): nothing to carry on, so the page says why. */
    test("a stored passkey with no session left says the sign-up was interrupted", async () => {
        await storeSignUpPasskey(storage, {
            authPrincipal: "someone",
            credentialId: Uint8Array.from([1]),
        });

        await startWith(undefined);

        expect(signUpInterruptedStore.value).toBe(true);
        expect(await getSignUpPasskey(storage)).toBeUndefined();
    });

    /** Invariant 3: signing out drops the sign-up's passkey with the delegation it was for. */
    test("signing out drops the stored passkey", async () => {
        await startWith(undefined);
        const client = new OpenChat(config());
        await vi.advanceTimersByTimeAsync(0);
        await storeSignUpPasskey(storage, {
            authPrincipal: "someone",
            credentialId: Uint8Array.from([1]),
        });
        vi.mocked(OpenChat.prototype.logout).mockRestore();
        // the navigation that ends a sign-out, which jsdom doesn't do
        vi.spyOn(window, "location", "get").mockReturnValue({
            replace: vi.fn(),
        } as unknown as Location);

        const signingOut = client.logout();
        await vi.advanceTimersByTimeAsync(10_000);
        await signingOut;

        expect(await getSignUpPasskey(storage)).toBeUndefined();
    });

    /** Invariant 3: a passkey stored for one principal is never sent for another's delegation,
     * and is dropped. */
    test("a passkey stored for someone else is neither sent nor kept", async () => {
        const { session } = await passkeySession();
        const other = await passkeySession();
        await storeSignUpPasskey(storage, {
            authPrincipal: other.principal,
            credentialId: Uint8Array.from([9]),
        });

        await startWith(session);

        expect(created()[0].webAuthnCredentialId).toBeUndefined();
        expect(await getSignUpPasskey(storage)).toBeUndefined();
    });
});
