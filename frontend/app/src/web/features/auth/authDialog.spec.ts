import { AuthProvider } from "@client";
import { flushSync } from "svelte";
import { AuthDialogProps, pageSignIns } from "./authDialog.svelte";
import type { Auth } from "./signIn";

function fakeAuth(referrer: Promise<{ userId: string; name: string }>) {
    return {
        wallets: { eth: [], sol: [] },
        termsUrl: "/terms",
        lastEmail: () => "me@example.com",
        loadReferrer: () => referrer,
    } as unknown as Auth;
}

describe("the dialog's props", () => {
    test("prefill the last email, and the referral link's referrer once it has loaded", async () => {
        const referrer = Promise.resolve({ userId: "r1", name: "Rita" });
        const dialog = new AuthDialogProps(fakeAuth(referrer));
        expect(dialog.props([], AuthProvider.PASSKEY).email).toBe("me@example.com");
        expect(dialog.props([], AuthProvider.PASSKEY).referrer).toBeUndefined();
        await referrer;
        flushSync();
        expect(dialog.props([], AuthProvider.PASSKEY).referrer?.userId).toBe("r1");
    });

    test("put the method the host says was last used first", () => {
        vi.stubGlobal("PublicKeyCredential", class {});
        const dialog = new AuthDialogProps(fakeAuth(new Promise(() => {})));
        expect(dialog.props(["II", "ETH"], AuthProvider.ETH).methods).toEqual(["eth", "ii"]);
        vi.unstubAllGlobals();
    });
});

describe("a marketing page's own sign-ins", () => {
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

    test("forget a failed sign-up when the dialog closes, and one that fails after it", async () => {
        await expect(
            pageSignIns.track(Promise.reject(new Error("taken")), { signup: true }),
        ).rejects.toThrow();
        pageSignIns.closed();
        expect(pageSignIns.signupFailed).toBe(false);

        let fail!: (e: Error) => void;
        const late = pageSignIns.track(new Promise<void>((_, r) => (fail = r)), { signup: true });
        pageSignIns.closed();
        fail(new Error("Sign-up cancelled"));
        await expect(late).rejects.toThrow();
        expect(pageSignIns.signupFailed).toBe(false);
    });
});
