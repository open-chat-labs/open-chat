import {
    AuthProvider,
    identityStateStore,
    selectedAuthProviderStore,
    type IdentityState,
    type OpenChat,
} from "@client";
import { createAuth, untilSignedIn } from "./signIn";

const emailHandlers: {
    generateMagicLink: ReturnType<typeof vi.fn>;
    stopPolling: ReturnType<typeof vi.fn>;
}[] = [];
vi.mock("@src/utils/signin", () => ({
    EmailSigninHandler: class {
        generateMagicLink = vi.fn(async () => ({ kind: "success", code: "123" }));
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
        checkUsername: vi.fn(async () => "success"),
        searchUsers: vi.fn(async () => []),
        handleMagicLink: vi.fn(async () => ({ kind: "success" })),
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
});

describe("the sign-in callbacks", () => {
    let client: ReturnType<typeof fakeClient>;
    let auth: ReturnType<typeof createAuth>;
    const onEmailSignedIn = vi.fn();

    beforeEach(() => {
        emailHandlers.length = 0;
        client = fakeClient();
        auth = createAuth(client as unknown as OpenChat, onEmailSignedIn);
        set({ kind: "anon" });
    });
    afterEach(() => {
        auth.stopEmail();
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

    test("a refused account keeps the form, with no user", async () => {
        client.registerUser.mockResolvedValueOnce({ kind: "username_taken" } as never);
        await expect(auth.onSignup({ username: "taken1" })).rejects.toThrow("username_taken");
        expect(client.onRegisteredUser).not.toHaveBeenCalled();
    });

    test("a username is free only when the check says so, and offline is a failed check", async () => {
        await expect(auth.checkUsername!("newperson")).resolves.toBe(true);
        client.checkUsername.mockResolvedValueOnce("username_taken");
        await expect(auth.checkUsername!("hamish")).resolves.toBe(false);
        client.checkUsername.mockResolvedValueOnce("offline");
        await expect(auth.checkUsername!("anyone")).rejects.toThrow();
    });

    test("an emailed link gives its code, and enters once it's followed", async () => {
        await expect(auth.onRequestEmailLink!("me@example.com")).resolves.toEqual({ code: "123" });
        expect(emailHandlers[0].generateMagicLink).toHaveBeenCalledWith("me@example.com");
        set({ kind: "loading_user", registering: false });
        expect(onEmailSignedIn).not.toHaveBeenCalled();
        set({ kind: "logged_in" });
        expect(onEmailSignedIn).toHaveBeenCalledWith("logged_in");
    });

    test("a link given up on doesn't enter", async () => {
        await auth.onRequestEmailLink!("me@example.com");
        auth.stopEmail();
        expect(emailHandlers[0].stopPolling).toHaveBeenCalled();
        set({ kind: "logged_in" });
        expect(onEmailSignedIn).not.toHaveBeenCalled();
    });

    test("a link that couldn't be sent fails", async () => {
        emailHandlers[0].generateMagicLink.mockResolvedValueOnce({ kind: "email_invalid" });
        await expect(auth.onRequestEmailLink!("bad")).rejects.toThrow("email_invalid");
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
