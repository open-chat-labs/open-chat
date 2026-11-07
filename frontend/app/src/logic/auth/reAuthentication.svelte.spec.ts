import { AuthProvider, type OpenChat } from "@client";
import { ReAuthentication } from "./reAuthentication.svelte";

describe("the ways to sign in again", () => {
    test("are all of them until the linked ones are known, then only those", async () => {
        const client: Pick<OpenChat, "reAuthProviders"> = {
            reAuthProviders: async () => new Set([AuthProvider.EMAIL]),
        };
        const reAuth = new ReAuthentication(client as OpenChat);
        expect(reAuth.providers).toEqual(new Set());
        await reAuth.loadProviders();
        expect(reAuth.providers).toEqual(new Set([AuthProvider.EMAIL]));
    });
});

describe("signing in again with an emailed link", () => {
    test("can be given up, going back to the ways to sign in", async () => {
        let aborted = false;
        const client: Pick<OpenChat, "requestEmailReAuthentication"> = {
            requestEmailReAuthentication: (_email, signal) =>
                new Promise((resolve) =>
                    signal?.addEventListener("abort", () => {
                        aborted = true;
                        resolve({ kind: "cancelled" });
                    }),
                ),
        };
        const reAuth = new ReAuthentication(client as OpenChat);
        const signingIn = reAuth.login(AuthProvider.EMAIL, "me@example.com");
        expect(reAuth.step).toBe("signing_in_with_email");
        expect(reAuth.lastEmail()).toBe("me@example.com");
        reAuth.cancelEmail();
        expect(await signingIn).toBeUndefined();
        expect(aborted).toBe(true);
        expect(reAuth.step).toBe("choose_provider");
    });
});
