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
        expect(dialog.props([], "PASSKEY" as never).email).toBe("me@example.com");
        expect(dialog.props([], "PASSKEY" as never).referrer).toBeUndefined();
        await referrer;
        flushSync();
        expect(dialog.props([], "PASSKEY" as never).referrer?.userId).toBe("r1");
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
});
