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
