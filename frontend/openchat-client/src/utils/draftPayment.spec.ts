import type {
    CryptocurrencyContent,
    P2PSwapContentInitial,
    PendingCryptocurrencyTransfer,
    PrizeContentInitial,
} from "@shared";
import { externalWalletPayment } from "./draftPayment";

const pending: PendingCryptocurrencyTransfer = {
    kind: "pending",
    ledger: "ledger",
    token: "ICP",
    recipient: "bob",
    amountE8s: 100_000_000n,
    feeE8s: 10_000n,
    createdAtNanos: 0n,
};

const transfer = (from: Partial<PendingCryptocurrencyTransfer>): CryptocurrencyContent => ({
    kind: "crypto_content",
    transfer: { ...pending, ...from },
});

const swap = (from: Partial<P2PSwapContentInitial>): P2PSwapContentInitial => ({
    kind: "p2p_swap_content_initial",
    token0: { ledger: "ledger0", symbol: "ICP", fee: 10_000n, decimals: 8 },
    token1: { ledger: "ledger1", symbol: "CHAT", fee: 100_000n, decimals: 8 },
    token0Amount: 500_000_000n,
    token1Amount: 1_000_000_000n,
    expiresIn: 86_400_000n,
    ...from,
});

describe("a draft's payment from an external wallet", () => {
    // 5d invariant 4
    test("an attached payment from an external wallet carries fromWallet and asks for no approval until it's sent", () => {
        const draft = transfer({ fromWallet: "plug" });
        const payment = externalWalletPayment(draft);
        expect(payment).toMatchObject({
            fromWallet: "plug",
            ledger: "ledger",
            amount: 100_000_000n,
            fees: 10_000n,
        });
        // what's sent once the wallet has approved: from the approved account, the wallet's
        // intent dropped, and nothing more to approve
        const approved = payment?.approved("account");
        expect(approved).toEqual({
            kind: "crypto_content",
            transfer: { ...pending, fromWallet: undefined, fromAccount: "account" },
        });
        expect(externalWalletPayment(approved)).toBeUndefined();
    });

    test("a payment from the OpenChat account needs no wallet's approval", () => {
        expect(externalWalletPayment(transfer({}))).toBeUndefined();
        expect(externalWalletPayment(undefined)).toBeUndefined();
    });

    test("a prize's fund is approved as a transfer is", () => {
        const prize: PrizeContentInitial = {
            kind: "prize_content_initial",
            diamondOnly: false,
            lifetimeDiamondOnly: false,
            uniquePersonOnly: false,
            streakOnly: 0,
            minChitEarned: 0,
            minAccountAgeMs: 0,
            excludedUsers: [],
            endDate: 0n,
            transfer: { ...pending, fromWallet: "oisy" },
            prizes: [],
            fees: 0n,
            amount: 0n,
        };
        expect(externalWalletPayment(prize)?.fromWallet).toBe("oisy");
    });

    test("a swap offer's allowance is its amount plus two of its token's fees", () => {
        const payment = externalWalletPayment(swap({ fromWallet: "plug" }));
        expect(payment).toMatchObject({ ledger: "ledger0", amount: 500_000_000n, fees: 20_000n });
        expect(payment?.approved("account")).toMatchObject({
            fromWallet: undefined,
            fromAccount: "account",
        });
        expect(externalWalletPayment(swap({}))).toBeUndefined();
    });
});
