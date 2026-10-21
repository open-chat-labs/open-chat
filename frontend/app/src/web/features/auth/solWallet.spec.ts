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

const { signWithSolana } = await import("./solWallet");

describe("signing in with a Solana wallet", () => {
    test("a failed start of the wallet adapters is tried again on the next sign-in", async () => {
        store.initialize.mockRejectedValueOnce(new Error("no localStorage"));
        const client = {} as OpenChat;
        await expect(signWithSolana(client, "Phantom")).rejects.toThrow("no localStorage");

        // the second try starts the adapters again and gets as far as connecting
        store.initialize.mockResolvedValueOnce(undefined);
        store.state = {
            select: vi.fn(),
            connect: vi.fn(async () => {
                throw new Error("declined");
            }),
        };
        await expect(signWithSolana(client, "Phantom")).rejects.toThrow("declined");
        expect(store.initialize).toHaveBeenCalledTimes(2);
    });

    test("a wallet that won't connect by itself (auto-connect) fails with its own error", async () => {
        const { onError } = store.initialize.mock.calls[1][0] as { onError: (e: Error) => void };
        const locked = new Error("WalletConnectionError: locked");
        // picking the wallet starts its auto-connect, which reports the error and swallows it
        store.state = {
            select: vi.fn(() => onError(locked)),
            connect: vi.fn(async () => {}),
            publicKey: null,
        };
        await expect(signWithSolana({} as OpenChat, "Phantom")).rejects.toBe(locked);
    });

    test("given up while the wallet store settles, it doesn't pick the wallet", async () => {
        const closed = new AbortController();
        closed.abort();
        store.state = { select: vi.fn(), connect: vi.fn() };
        await expect(signWithSolana({} as OpenChat, "Phantom", closed.signal)).rejects.toThrow();
        expect(store.state.select).not.toHaveBeenCalled();
    });

    test("given up while the wallet connects, it goes no further when the wallet answers", async () => {
        const closed = new AbortController();
        const client = { siwsPrepareLogin: vi.fn() } as unknown as OpenChat;
        store.state = {
            select: vi.fn(),
            connect: vi.fn(async () => closed.abort()),
            publicKey: { toBase58: () => "addr" },
            wallet: {},
            signMessage: vi.fn(),
        };
        await expect(signWithSolana(client, "Phantom", closed.signal)).rejects.toThrow();
        expect(client.siwsPrepareLogin).not.toHaveBeenCalled();
    });
});
