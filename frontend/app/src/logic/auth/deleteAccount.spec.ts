import { deleteAccount, type SignedInAgain } from "./deleteAccount";

describe("deleting the account", () => {
    test("deleteCurrentUser is only called with a key and delegation from a re-authentication of the current principal", async () => {
        const keyPair = { publicKey: {}, privateKey: {} } as CryptoKeyPair;
        const json = { delegations: [], publicKey: "pk" };
        const signedInAgain: SignedInAgain = {
            key: { getKeyPair: () => keyPair },
            delegation: { toJSON: () => json },
        };
        const client = { deleteCurrentUser: vi.fn(async () => true) };

        expect(await deleteAccount(client, signedInAgain)).toBe(true);
        expect(client.deleteCurrentUser).toHaveBeenCalledWith(keyPair, json);
    });
});
