import { AuthProvider } from "@client";
import { DelegationChain, ECDSAKeyIdentity } from "@icp-sdk/core/identity";
import { deleteAccount } from "./deleteAccount";
import type { ReAuthSuccess } from "./reAuthentication.svelte";

describe("deleting the account", () => {
    test("deleteCurrentUser is only called with a key and delegation from a re-authentication of the current principal", async () => {
        // what signing in again gives: a session key, and the delegation to it
        const key = await ECDSAKeyIdentity.generate();
        const delegation = await DelegationChain.create(key, key.getPublicKey());
        const signedInAgain: ReAuthSuccess = {
            kind: "success",
            provider: AuthProvider.PASSKEY,
            key,
            delegation,
            signInProofJwt: undefined,
        };
        const client = { deleteCurrentUser: vi.fn(async () => true) };

        expect(await deleteAccount(client, signedInAgain)).toBe(true);
        expect(client.deleteCurrentUser).toHaveBeenCalledWith(
            key.getKeyPair(),
            delegation.toJSON(),
        );
    });
});
