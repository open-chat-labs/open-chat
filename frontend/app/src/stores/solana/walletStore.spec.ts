import { settledWallet, walletStore } from "./walletStore";

describe("the Solana wallet store, settled", () => {
    afterEach(() => walletStore.setConnecting(false));

    test("is its value straight away with no connection in flight", async () => {
        await expect(settledWallet()).resolves.toMatchObject({ connecting: false });
    });

    test("waits for a connection in flight (an auto-connect) to finish", async () => {
        walletStore.setConnecting(true);
        let settled = false;
        const waiting = settledWallet().then(() => (settled = true));
        await Promise.resolve();
        expect(settled).toBe(false);
        walletStore.setConnecting(false);
        await waiting;
        expect(settled).toBe(true);
    });
});
