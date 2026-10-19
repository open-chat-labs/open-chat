import type { OpenChat } from "@client";

const store = vi.hoisted(() => ({
    initialize: vi.fn(),
    state: {} as Record<string, unknown>,
}));

vi.mock("@src/stores/solana/walletStore", () => ({
    initialize: store.initialize,
    settledWallet: async () => store.state,
}));
vi.mock("@solana/wallet-adapter-coinbase", () => ({ CoinbaseWalletAdapter: class {} }));
vi.mock("@solana/wallet-adapter-phantom", () => ({ PhantomWalletAdapter: class {} }));
vi.mock("@solana/wallet-adapter-walletconnect", () => ({ WalletConnectWalletAdapter: class {} }));

const { signInWithSolana } = await import("./solWallet");

describe("signing in with a Solana wallet", () => {
    test("a failed start of the wallet adapters is tried again on the next sign-in", async () => {
        store.initialize.mockRejectedValueOnce(new Error("no localStorage"));
        const client = {} as OpenChat;
        await expect(signInWithSolana(client, "Phantom")).rejects.toThrow("no localStorage");

        // the second try starts the adapters again and gets as far as connecting
        store.initialize.mockResolvedValueOnce(undefined);
        store.state = {
            select: vi.fn(),
            connect: vi.fn(async () => {
                throw new Error("declined");
            }),
        };
        await expect(signInWithSolana(client, "Phantom")).rejects.toThrow("declined");
        expect(store.initialize).toHaveBeenCalledTimes(2);
    });
});
