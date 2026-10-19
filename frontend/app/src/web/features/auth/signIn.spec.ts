import {
    AuthProvider,
    identityStateStore,
    selectedAuthProviderStore,
    type IdentityState,
    type OpenChat,
} from "@client";
import { configKeys } from "@shared";
import { createAuth, signInAbandoned, untilSignedIn } from "./signIn";

const eth = vi.hoisted(() => ({ signals: [] as (AbortSignal | undefined)[] }));
vi.mock("./ethWallet", () => ({
    ethWallets: () => [{ id: "io.rabby", name: "Rabby Wallet" }],
    signInWithEthereum: async (_client: unknown, _id: string, signal?: AbortSignal) => {
        eth.signals.push(signal);
    },
}));

// each link request has its own handler; magicLink answers them all
const magicLink = vi.fn();
const emailHandlers: {
    generateMagicLink: ReturnType<typeof vi.fn>;
    stopPolling: ReturnType<typeof vi.fn>;
}[] = [];
vi.mock("@src/utils/signin", () => ({
    EmailSigninHandler: class {
        generateMagicLink = vi.fn((address: string) => magicLink(address));
        stopPolling = vi.fn();
        constructor() {
            emailHandlers.push(this);
        }
    },
}));

const set = (state: IdentityState) => identityStateStore.set(state);

function fakeClient() {
    return {
        gaTrack: vi.fn(),
        login: vi.fn(() => set({ kind: "logging_in" })),
        signInWithWebAuthn: vi.fn(async () => {}),
        signUpWithWebAuthn: vi.fn(async () => {
            set({ kind: "registering" });
        }),
        registerUser: vi.fn(async () => ({
            kind: "success",
            userId: "u1",
            icpAccount: "acc",
        })),
        onRegisteredUser: vi.fn(),
        setReferralCode: vi.fn(),
        clearReferralCode: vi.fn(),
        getReferringUser: vi.fn(async () => undefined as unknown),
        checkUsername: vi.fn(async () => "success"),
        searchUsers: vi.fn(async () => []),
        handleMagicLink: vi.fn(async () => ({ kind: "success" })),
        logout: vi.fn(async () => set({ kind: "anon" })),
        updateIdentityState: vi.fn((state: IdentityState) => set(state)),
    };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("waiting for a sign-in", () => {
    afterEach(() => set({ kind: "anon" }));

    test("settles on a user, or on an identity without one", async () => {
        const signedIn = untilSignedIn(() => set({ kind: "logging_in" }));
        set({ kind: "loading_user", registering: false });
        set({ kind: "logged_in" });
        await expect(signedIn).resolves.toBe("logged_in");

        set({ kind: "logging_in" });
        const registering = untilSignedIn(() => {});
        set({ kind: "registering" });
        await expect(registering).resolves.toBe("registering");
    });

    test("fails when the identity falls back to anonymous, or the start fails", async () => {
        const cancelled = untilSignedIn(() => set({ kind: "logging_in" }));
        set({ kind: "anon" });
        await expect(cancelled).rejects.toThrow();
        await expect(untilSignedIn(() => Promise.reject(new Error("declined")))).rejects.toThrow(
            "declined",
        );
    });

    test("is given up by its signal, whether its start has settled or not", async () => {
        const walkedAway = new AbortController();
        const neverStarts = untilSignedIn(() => new Promise(() => {}), walkedAway.signal);
        walkedAway.abort();
        await expect(neverStarts).rejects.toThrow("given up");

        const closed = new AbortController();
        const waiting = untilSignedIn(() => set({ kind: "logging_in" }), closed.signal);
        await flush();
        closed.abort();
        await expect(waiting).rejects.toThrow("given up");
        // and stops watching: a later sign-in isn't this one's
        set({ kind: "logged_in" });
    });
});

describe("the sign-in callbacks", () => {
    let client: ReturnType<typeof fakeClient>;
    let auth: ReturnType<typeof createAuth>;
    const onEmailSignedIn = vi.fn();

    beforeEach(() => {
        emailHandlers.length = 0;
        magicLink.mockReset();
        magicLink.mockImplementation(async () => ({ kind: "success", code: "123" }));
        client = fakeClient();
        auth = createAuth(client as unknown as OpenChat, {
            translate: (key) => `translated:${key}`,
            onEmailSignedIn,
        });
        set({ kind: "anon" });
    });
    afterEach(() => {
        auth.dispose();
        // a user ends anything a test walked away from (it outlives a host)
        set({ kind: "logged_in" });
        set({ kind: "anon" });
        onEmailSignedIn.mockReset();
    });

    test("Internet Identity opens the auth client's window and settles on the user", async () => {
        const signedIn = auth.onMethod("ii", "login");
        await flush();
        expect(selectedAuthProviderStore.value).toBe(AuthProvider.II);
        expect(client.login).toHaveBeenCalled();
        set({ kind: "logged_in" });
        await expect(signedIn).resolves.toBe("logged_in");
    });

    test("a declined passkey goes back to the choices", async () => {
        client.signInWithWebAuthn.mockRejectedValueOnce(new Error("NotAllowedError"));
        await expect(auth.onMethod("passkey", "login")).rejects.toThrow("NotAllowedError");
    });

    test("sign-up makes a passkey, then the account, and hands the user to the client", async () => {
        await auth.onSignup({ username: "newperson", email: "me@example.com", referrerId: "r1" });
        expect(client.setReferralCode).toHaveBeenCalledWith("r1");
        expect(client.signUpWithWebAuthn).toHaveBeenCalledWith(true, "newperson");
        expect(client.registerUser).toHaveBeenCalledWith("newperson", "me@example.com");
        expect(client.onRegisteredUser).toHaveBeenCalledWith(
            expect.objectContaining({ kind: "created_user", username: "newperson", userId: "u1" }),
        );
    });

    test("an identity without an account only needs the account", async () => {
        set({ kind: "registering" });
        await auth.onSignup({ username: "newperson" });
        expect(client.signUpWithWebAuthn).not.toHaveBeenCalled();
        expect(client.registerUser).toHaveBeenCalledWith("newperson", undefined);
    });

    test("a refused account keeps the form, says why in the app's words, and has no user", async () => {
        client.registerUser.mockResolvedValueOnce({ kind: "username_taken" } as never);
        await expect(auth.onSignup({ username: "taken1" })).rejects.toEqual({
            reason: "translated:register.usernameTaken",
        });
        expect(client.onRegisteredUser).not.toHaveBeenCalled();
    });

    test("the referrer from a referral link is offered, and removing it drops the code", async () => {
        client.getReferringUser.mockResolvedValueOnce({
            userId: "r1",
            username: "hamish",
            displayName: "Hamish",
        });
        await expect(auth.loadReferrer()).resolves.toMatchObject({
            userId: "r1",
            name: "Hamish",
            handle: "hamish",
        });
        set({ kind: "registering" });
        await auth.onSignup({ username: "newperson" });
        expect(client.clearReferralCode).toHaveBeenCalled();
        expect(client.setReferralCode).not.toHaveBeenCalled();
    });

    test("a referrer that can't be looked up is no referrer", async () => {
        client.getReferringUser.mockRejectedValueOnce(new Error("offline"));
        await expect(auth.loadReferrer()).resolves.toBeUndefined();
    });

    test("the referrer is looked up once, however often the dialog opens", async () => {
        await auth.loadReferrer();
        await auth.loadReferrer();
        expect(client.getReferringUser).toHaveBeenCalledOnce();
    });

    test("without a referrer, no stored code goes with the sign-up", async () => {
        // e.g. a referrer picked on a failed try and then removed, or a ?ref= naming no one
        set({ kind: "registering" });
        await auth.onSignup({ username: "newperson" });
        expect(client.clearReferralCode).toHaveBeenCalled();
        expect(client.clearReferralCode.mock.invocationCallOrder[0]).toBeLessThan(
            client.registerUser.mock.invocationCallOrder[0],
        );
    });

    test("a sign-up cancelled while its passkey is made goes no further", async () => {
        let passkeyMade!: () => void;
        client.signUpWithWebAuthn.mockImplementationOnce(
            () => new Promise<void>((resolve) => (passkeyMade = resolve)),
        );
        const signup = auth.onSignup({ username: "newperson" });
        await Promise.resolve();
        auth.cancel();
        set({ kind: "loading_user", registering: true });
        expect(client.logout).not.toHaveBeenCalled();
        set({ kind: "registering" });
        passkeyMade();
        await expect(signup).rejects.toThrow("Sign-up cancelled");
        expect(client.registerUser).not.toHaveBeenCalled();
        // the identity it made, without an account, is signed out
        expect(client.logout).toHaveBeenCalledOnce();
    });

    test("closing after a refused account signs the identity out", async () => {
        client.registerUser.mockResolvedValueOnce({ kind: "username_taken" } as never);
        await expect(auth.onSignup({ username: "taken1" })).rejects.toBeDefined();
        expect(identityStateStore.value.kind).toBe("registering");
        auth.cancel();
        expect(client.logout).toHaveBeenCalledOnce();
    });

    test("closing gives up the sign-in it was waiting on, and a new one ends the watch", async () => {
        const waiting = auth.onMethod("ii", "login");
        await flush();
        auth.cancel();
        await expect(waiting).rejects.toThrow("given up");
        // the client's login is given up too, so "/" shows Landing
        expect(client.updateIdentityState).toHaveBeenCalledWith({ kind: "anon" });
        // a new attempt is the person's own: whatever it comes to isn't signed out
        const again = auth.onMethod("ii", "login");
        await flush();
        set({ kind: "registering" });
        await expect(again).resolves.toBe("registering");
        expect(client.logout).not.toHaveBeenCalled();
    });

    test("a username is free only when the check says so, and offline is a failed check", async () => {
        await expect(auth.checkUsername!("newperson")).resolves.toBe(true);
        client.checkUsername.mockResolvedValueOnce("username_taken");
        await expect(auth.checkUsername!("hamish")).resolves.toBe(false);
        client.checkUsername.mockResolvedValueOnce("offline");
        await expect(auth.checkUsername!("anyone")).rejects.toThrow();
    });

    test("an emailed link gives its code, and enters once it's followed", async () => {
        localStorage.removeItem(configKeys.selectedAuthEmail);
        await expect(auth.onRequestEmailLink!("me@example.com")).resolves.toEqual({ code: "123" });
        // the address is remembered for next time
        expect(auth.lastEmail()).toBe("me@example.com");
        expect(magicLink).toHaveBeenCalledWith("me@example.com");
        set({ kind: "loading_user", registering: false });
        expect(onEmailSignedIn).not.toHaveBeenCalled();
        set({ kind: "logged_in" });
        expect(onEmailSignedIn).toHaveBeenCalledWith("logged_in");
    });

    test("a link asked for by an identity without an account waits for the link", async () => {
        set({ kind: "registering" });
        await auth.onRequestEmailLink!("me@example.com");
        expect(onEmailSignedIn).not.toHaveBeenCalled();
        set({ kind: "loading_user", registering: false });
        set({ kind: "logged_in" });
        expect(onEmailSignedIn).toHaveBeenCalledWith("logged_in");
    });

    test("a link given up on doesn't enter, and counts as cancelled once", async () => {
        await auth.onRequestEmailLink!("me@example.com");
        auth.onCancelEmailLink!();
        // the dialog unmounting stops it again
        auth.onCancelEmailLink!();
        const cancels = client.gaTrack.mock.calls.filter(([e]) => e === "email_signin_cancelled");
        expect(cancels).toEqual([["email_signin_cancelled", "registration"]]);
        expect(emailHandlers[0].stopPolling).toHaveBeenCalled();
        set({ kind: "logged_in" });
        expect(onEmailSignedIn).not.toHaveBeenCalled();
    });

    test("a link that signed in isn't counted as cancelled when its dialog goes", async () => {
        await auth.onRequestEmailLink!("me@example.com");
        set({ kind: "loading_user", registering: false });
        set({ kind: "logged_in" });
        auth.onCancelEmailLink!();
        expect(client.gaTrack).not.toHaveBeenCalledWith("email_signin_cancelled", "registration");
    });

    test("a link that couldn't be sent fails", async () => {
        magicLink.mockResolvedValueOnce({ kind: "email_invalid" });
        await expect(auth.onRequestEmailLink!("bad")).rejects.toEqual({
            reason: "translated:loginDialog.invalidEmail",
        });
    });

    test("a resend that fails leaves the link sent before working", async () => {
        await auth.onRequestEmailLink!("me@example.com");
        magicLink.mockResolvedValueOnce({ kind: "failed_to_send_email" });
        await expect(auth.onRequestEmailLink!("me@example.com")).rejects.toBeDefined();
        expect(emailHandlers[0].stopPolling).not.toHaveBeenCalled();
        set({ kind: "loading_user", registering: false });
        set({ kind: "logged_in" });
        expect(onEmailSignedIn).toHaveBeenCalledWith("logged_in");
    });

    test("a resend that's sent replaces the link before", async () => {
        await auth.onRequestEmailLink!("me@example.com");
        await auth.onRequestEmailLink!("me@example.com");
        expect(emailHandlers[0].stopPolling).toHaveBeenCalled();
        expect(emailHandlers[1].stopPolling).not.toHaveBeenCalled();
    });

    test("closing while the link is being sent drops it once it is", async () => {
        let sent!: (resp: unknown) => void;
        magicLink.mockImplementationOnce(() => new Promise((resolve) => (sent = resolve)));
        const request = auth.onRequestEmailLink!("me@example.com");
        auth.cancel();
        sent({ kind: "success", code: "123" });
        await expect(request).rejects.toThrow("given up");
        expect(emailHandlers[0].stopPolling).toHaveBeenCalled();
        set({ kind: "loading_user", registering: false });
        set({ kind: "logged_in" });
        expect(onEmailSignedIn).not.toHaveBeenCalled();
    });

    test("the link page's code goes with the link's query, and the answer is named", async () => {
        await expect(auth.onLinkCode("?auth&m=1", "123")).resolves.toBe("signed_in");
        expect(client.handleMagicLink).toHaveBeenCalledWith("?auth&m=1&c=123");
        client.handleMagicLink.mockResolvedValueOnce({ kind: "session_not_found" } as never);
        await expect(auth.onLinkCode("?auth&m=1", "123")).resolves.toBe("elsewhere");
        client.handleMagicLink.mockResolvedValueOnce({ kind: "link_expired" } as never);
        await expect(auth.onLinkCode("?auth&m=1", "123")).resolves.toBe("expired");
        client.handleMagicLink.mockResolvedValueOnce({ kind: "link_invalid" } as never);
        await expect(auth.onLinkCode("?auth&m=1", "123")).resolves.toBe("invalid");
    });
});

describe("a sign-in walked away from", () => {
    const host = (client: ReturnType<typeof fakeClient>) =>
        createAuth(client as unknown as OpenChat, { translate: (key) => key });

    afterEach(() => {
        set({ kind: "logged_in" });
        set({ kind: "anon" });
    });

    test("is seen through after its host has gone, whichever host is mounted then", async () => {
        const client = fakeClient();
        const landing = host(client);
        set({ kind: "logging_in" });
        landing.cancel();
        landing.dispose();
        // the II window completes anyway, for a principal without an account
        set({ kind: "loading_user", registering: true });
        expect(signInAbandoned()).toBe(true);
        set({ kind: "registering" });
        expect(client.logout).toHaveBeenCalledOnce();
        await flush();
        expect(signInAbandoned()).toBe(false);
    });

    test("stays abandoned until the sign-out is through", async () => {
        const client = fakeClient();
        let signedOut!: () => void;
        client.logout.mockImplementationOnce(() => new Promise<void>((r) => (signedOut = r)));
        host(client).cancel();
        set({ kind: "registering" });
        await flush();
        expect(signInAbandoned()).toBe(true);
        signedOut();
        await flush();
        expect(signInAbandoned()).toBe(false);
    });

    test("ends with a new sign-in from any host, which is then the person's own", async () => {
        const client = fakeClient();
        host(client).cancel();
        // a passkey doesn't go through "logging_in": starting it is what ends the walk-away
        const signedIn = host(client).onMethod("passkey", "login");
        expect(signInAbandoned()).toBe(false);
        set({ kind: "registering" });
        await expect(signedIn).resolves.toBe("registering");
        expect(client.logout).not.toHaveBeenCalled();
    });
});

describe("the wallet sign-ins", () => {
    afterEach(() => {
        set({ kind: "logged_in" });
        set({ kind: "anon" });
    });

    test("list Ethereum's wallets when it's picked, from wagmi's connectors", async () => {
        const auth = createAuth(fakeClient() as unknown as OpenChat, { translate: (k) => k });
        const eth = auth.wallets.eth as () => Promise<unknown>;
        await expect(eth()).resolves.toEqual([{ id: "io.rabby", name: "Rabby Wallet" }]);
    });

    test("are given up when the dialog closes, so a wallet answering late signs no one in", async () => {
        const auth = createAuth(fakeClient() as unknown as OpenChat, { translate: (k) => k });
        const attempt = auth.onMethod("eth", "login", "io.rabby").catch(() => {});
        await flush();
        auth.cancel();
        await attempt;
        expect(eth.signals.at(-1)?.aborted).toBe(true);
    });
});
