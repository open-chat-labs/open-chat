import { AuthProvider, identityStateStore } from "@client";
import type { AuthOption } from "@openchat/ui/src/features/components/AuthDialog.svelte";
import { flushSync } from "svelte";
import { AuthDialogProps, pageSignIns, type AuthDialogHost } from "./authDialog.svelte";

let lastEmail = "me@example.com";

// the methods as AuthDialog names them (the web's auth.adapter)
const OPTIONS: Record<AuthProvider, AuthOption> = {
    [AuthProvider.PASSKEY]: "passkey",
    [AuthProvider.EMAIL]: "email",
    [AuthProvider.II]: "ii",
    [AuthProvider.ETH]: "eth",
    [AuthProvider.SOL]: "sol",
    [AuthProvider.NFID]: "nfid",
};
const option = (provider: AuthProvider) => OPTIONS[provider];

function fakeAuth(referrer: Promise<{ userId: string; name: string }>) {
    return {
        wallets: { eth: [], sol: [] },
        termsUrl: "/terms",
        lastEmail: () => lastEmail,
        loadReferrer: () => referrer,
    } as unknown as AuthDialogHost;
}

describe("the dialog's props", () => {
    test("look the referral link's referrer up as the dialog first opens, not before", async () => {
        const referrer = Promise.resolve({ userId: "r1", name: "Rita" });
        const loadReferrer = vi.fn(() => referrer);
        const dialog = new AuthDialogProps({
            ...fakeAuth(referrer),
            loadReferrer,
        } as unknown as AuthDialogHost, option);
        expect(loadReferrer).not.toHaveBeenCalled();
        dialog.opening();
        expect(dialog.props([], AuthProvider.PASSKEY).referrer).toBeUndefined();
        await referrer;
        flushSync();
        expect(dialog.props([], AuthProvider.PASSKEY).referrer?.userId).toBe("r1");
        dialog.opening();
        expect(loadReferrer).toHaveBeenCalledOnce();
    });

    test("put the method the host says was last used first", () => {
        vi.stubGlobal("PublicKeyCredential", class {});
        const dialog = new AuthDialogProps(fakeAuth(new Promise(() => {})), option);
        expect(dialog.props(["II", "ETH"], AuthProvider.ETH).methods).toEqual(["eth", "ii"]);
        // without a passkey on offer, Create account (a passkey) isn't either
        expect(dialog.props(["II", "ETH"], AuthProvider.ETH).passkeySignup).toBe(false);
        expect(dialog.props([], AuthProvider.ETH).passkeySignup).toBe(true);
        vi.unstubAllGlobals();
    });
});

describe("the prefilled email", () => {
    test("is the last address a link went to, read again when the dialog opens", () => {
        const dialog = new AuthDialogProps(fakeAuth(new Promise(() => {})), option);
        lastEmail = "first@example.com";
        dialog.opening();
        lastEmail = "second@example.com";
        expect(dialog.props([], AuthProvider.PASSKEY).email).toBe("first@example.com");
        dialog.opening();
        expect(dialog.props([], AuthProvider.PASSKEY).email).toBe("second@example.com");
    });
});

describe("a marketing page's own sign-ins", () => {
    // a sign-up that fails at registerUser leaves an identity without an account
    beforeEach(() => identityStateStore.set({ kind: "registering" }));
    afterEach(() => {
        identityStateStore.set({ kind: "anon" });
        pageSignIns.started();
        pageSignIns.emailDone();
    });

    test("count as going on until each settles, whether it signs in or fails", async () => {
        let succeed!: () => void;
        let fail!: (e: Error) => void;
        const ok = pageSignIns.track(new Promise<void>((r) => (succeed = r)));
        const failed = pageSignIns.track(new Promise<void>((_, r) => (fail = r)));
        expect(pageSignIns.pending).toBe(2);
        succeed();
        await ok;
        expect(pageSignIns.pending).toBe(1);
        fail(new Error("cancelled"));
        await expect(failed).rejects.toThrow("cancelled");
        expect(pageSignIns.pending).toBe(0);
    });

    test("remember a sign-up that failed, until the next attempt starts", async () => {
        await expect(
            pageSignIns.track(Promise.reject(new Error("taken")), { signup: true }),
        ).rejects.toThrow();
        expect(pageSignIns.signupFailed).toBe(true);
        await pageSignIns.track(Promise.resolve());
        expect(pageSignIns.signupFailed).toBe(false);
        // a failed sign-in isn't a failed sign-up
        await expect(pageSignIns.track(Promise.reject(new Error("declined")))).rejects.toThrow();
        expect(pageSignIns.signupFailed).toBe(false);
    });

    test("keep a failed sign-up through the close (until its sign-out), but not one after it", async () => {
        await expect(
            pageSignIns.track(Promise.reject(new Error("taken")), { signup: true }),
        ).rejects.toThrow();
        pageSignIns.closed();
        expect(pageSignIns.signupFailed).toBe(true);

        let fail!: (e: Error) => void;
        // a new attempt clears it
        const late = pageSignIns.track(new Promise<void>((_, r) => (fail = r)), { signup: true });
        expect(pageSignIns.signupFailed).toBe(false);
        pageSignIns.closed();
        fail(new Error("Sign-up cancelled"));
        await expect(late).rejects.toThrow();
        expect(pageSignIns.signupFailed).toBe(false);
    });

    test("leaving the page says whether it left something going", async () => {
        expect(pageSignIns.left()).toBe(false);
        let settle!: () => void;
        const going = pageSignIns.track(new Promise<void>((r) => (settle = r)));
        expect(pageSignIns.left()).toBe(true);
        settle();
        await going;
        // a failed sign-up, with nothing going
        await expect(
            pageSignIns.track(Promise.reject(new Error("taken")), { signup: true }),
        ).rejects.toThrow();
        expect(pageSignIns.signupFailed).toBe(true);
        expect(pageSignIns.left()).toBe(true);
    });

    test("don't count a sign-up that failed before its passkey, with nothing left behind", async () => {
        identityStateStore.set({ kind: "anon" });
        await expect(
            pageSignIns.track(Promise.reject(new Error("NotAllowedError")), { signup: true }),
        ).rejects.toThrow();
        expect(pageSignIns.signupFailed).toBe(false);
    });

    test("forget a failed sign-up on a close once its identity is gone", async () => {
        await expect(
            pageSignIns.track(Promise.reject(new Error("taken")), { signup: true }),
        ).rejects.toThrow();
        identityStateStore.set({ kind: "anon" });
        pageSignIns.closed();
        expect(pageSignIns.signupFailed).toBe(false);
    });

    test("trade a failed sign-up for the email link asked for after it, keeping Landing", async () => {
        await expect(
            pageSignIns.track(Promise.reject(new Error("taken")), { signup: true }),
        ).rejects.toThrow();
        let sent!: () => void;
        const request = pageSignIns.trackEmail(new Promise<void>((r) => (sent = r)));
        // still seeing a sign-in through, from the request on: Landing stays
        expect([pageSignIns.signupFailed, pageSignIns.signingIn]).toEqual([false, true]);
        sent();
        await request;
        expect(pageSignIns.signingIn).toBe(true);
        pageSignIns.emailDone();
        expect(pageSignIns.signingIn).toBe(false);
    });

    test("stop waiting on an email link when the dialog closes", async () => {
        await pageSignIns.trackEmail(Promise.resolve());
        pageSignIns.closed();
        expect(pageSignIns.signingIn).toBe(false);
    });

    test("go on to the app's home once signed in, or where the page asked to", () => {
        pageSignIns.opened();
        expect(pageSignIns.destination()).toBe("/");
        // /diamond's Upgrade: on to the Diamond dialog, once, over the list the signed-in user
        // starts on
        let scope = "/chats";
        pageSignIns.opened(() => `${scope}?diamond`);
        scope = "/favourite";
        expect(pageSignIns.destination()).toBe("/favourite?diamond");
        expect(pageSignIns.destination()).toBe("/");
        // the page's own Sign in, opened after, is a sign-in for the app
        pageSignIns.opened(() => "/chats?diamond");
        pageSignIns.opened();
        expect(pageSignIns.destination()).toBe("/");
    });

    test("go on nowhere once the dialog has closed", () => {
        pageSignIns.opened(() => "/chats?diamond");
        pageSignIns.closed();
        expect(pageSignIns.destination()).toBe("/");
    });

    test("keep waiting on the link before a resend that fails, and not on none", async () => {
        await expect(pageSignIns.trackEmail(Promise.reject(new Error("bad")))).rejects.toThrow();
        expect(pageSignIns.signingIn).toBe(false);
        await pageSignIns.trackEmail(Promise.resolve());
        await expect(pageSignIns.trackEmail(Promise.reject(new Error("bad")))).rejects.toThrow();
        expect(pageSignIns.signingIn).toBe(true);
    });
});
