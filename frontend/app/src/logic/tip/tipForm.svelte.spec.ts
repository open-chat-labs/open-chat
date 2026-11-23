import {
    cryptoBalanceStore,
    type Message,
    type MessageContext,
    cryptoLookup,
    exchangeRatesLookupStore,
    LEDGER_CANISTER_ICP,
    type CryptocurrencyDetails,
    type OpenChat,
} from "@client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TipForm } from "@src/logic/tip/tipForm.svelte";

const icp = {
    name: "Internet Computer",
    symbol: "ICP",
    ledger: LEDGER_CANISTER_ICP,
    decimals: 8,
    transferFee: 10_000n,
    enabled: true,
} as unknown as CryptocurrencyDetails;

const ckusdc = {
    name: "ckUSDC",
    symbol: "ckUSDC",
    ledger: "xevnm-gaaaa-aaaar-qafnq-cai",
    decimals: 6,
    transferFee: 10_000n,
    enabled: true,
} as unknown as CryptocurrencyDetails;

const client = {
    refreshAccountBalance: vi.fn(async () => 0n),
    tipMessage: vi.fn(async () => ({ kind: "tipped" })),
} as unknown as OpenChat;

describe("choosing a tip", () => {
    beforeEach(() => {
        cryptoLookup.set(
            new Map([
                [icp.ledger, icp],
                [ckusdc.ledger, ckusdc],
            ]),
        );
        // $5 an ICP, and a rate for ckUSDC that is rounded to 2 significant figures, 4.4
        exchangeRatesLookupStore.set(
            new Map([
                [icp.ledger, { toUSD: 5 }],
                [ckusdc.ledger, { toUSD: 4.37 }],
            ]),
        );
    });

    afterEach(() => {
        cryptoLookup.set(new Map());
        exchangeRatesLookupStore.set(new Map());
        cryptoBalanceStore.setBalance(icp.ledger, 0n);
        cryptoBalanceStore.setBalance(ckusdc.ledger, 0n);
        vi.clearAllMocks();
    });

    // Invariant: the amount tipped is the dollar amount the user picked, in the token
    test("picking 10 cents at $5 a token tips 0.02 tokens", () => {
        cryptoBalanceStore.setBalance(icp.ledger, 100_000_000n);
        const form = new TipForm(client, icp.ledger);

        form.add(10);

        expect(form.tokenState.draftAmount).toBe(2_000_000n);
        expect(form.centAmount).toBe(10);
    });

    // Invariant: the user can't pick more than they can pay from their OpenChat account, fees
    // included
    test("an amount the account can't cover can't be picked", () => {
        // 1.5 cents of ICP, less than a 10 cent tip and its fees
        cryptoBalanceStore.setBalance(icp.ledger, 300_000n);
        const form = new TipForm(client, icp.ledger);

        expect(form.canAdd(1)).toBe(true);
        expect(form.canAdd(10)).toBe(false);
    });

    test("picking 10 cents of a 6 decimal token at a rounded rate tips the right amount", () => {
        cryptoBalanceStore.setBalance(ckusdc.ledger, 100_000_000n);
        const form = new TipForm(client, ckusdc.ledger);

        form.add(10);

        // $0.10 / $4.4 = 0.0227273 tokens
        expect(form.tokenState.draftAmount).toBe(22_727n);
    });

    // The fees are the transfer and the approval the wallet makes before the tip is pulled
    test("an amount the account can only cover without the fees can't be picked or sent", async () => {
        // 1 cent of ICP plus one fee, which is one fee short
        cryptoBalanceStore.setBalance(icp.ledger, 200_000n + 10_000n);
        const form = new TipForm(client, icp.ledger);
        await vi.waitFor(() => expect(form.tokenChanging).toBe(false));

        expect(form.canAdd(1)).toBe(false);
        form.add(1);
        expect(form.valid).toBe(false);
    });

    // Invariant: the tip goes to the recipient it's given, the message's sender or whoever linked a
    // relayed message's account, from the wallet that approved it if there is one, with the
    // ledger's transfer fee
    test("a tip is sent to its recipient from the approving wallet", async () => {
        cryptoBalanceStore.setBalance(icp.ledger, 100_000_000n);
        const form = new TipForm(client, icp.ledger);
        form.add(10);
        // A relayed message, whose sender is the bridge bot, so the tip goes to someone else
        const message = { messageId: 1n, sender: "bridge-bot", tips: {} } as unknown as Message;
        const context: MessageContext = {
            chatId: { kind: "group_chat", groupId: "rrkah-fqaaa-aaaaa-aaaaq-cai" },
        };

        await form.tip(context, message, "linked-user", "wallet-account");

        expect(client.tipMessage).toHaveBeenCalledWith(
            context,
            message,
            expect.objectContaining({
                ledger: icp.ledger,
                recipient: "linked-user",
                amountE8s: 2_000_000n,
                feeE8s: 10_000n,
                fromAccount: "wallet-account",
            }),
        );
    });

    // Picking the token already chosen keeps the tip the user has built
    test("choosing the same token again keeps the amount", () => {
        cryptoBalanceStore.setBalance(icp.ledger, 100_000_000n);
        const form = new TipForm(client, icp.ledger);
        form.add(10);

        form.ledger = icp.ledger;

        expect(form.tokenState.draftAmount).toBe(2_000_000n);
    });

    // Desktop shows the balance with its own refreshing component, so the form must not refresh it
    // again
    test("a form told not to refresh the balance waits to be told it has been checked", () => {
        const form = new TipForm(client, icp.ledger, { refreshBalance: false });

        expect(client.refreshAccountBalance).not.toHaveBeenCalled();
        expect(form.tokenChanging).toBe(true);
        form.balanceChecked();
        expect(form.tokenChanging).toBe(false);
    });

    // Invariant: a balance the client couldn't refresh comes back from TokenState.refreshBalance as
    // "unable to refresh", which the form hands to the view; dropping it would leave the user with a
    // stale balance and no word of why
    test("a balance refresh that fails is handed to the view, with the token's symbol", async () => {
        const onRefreshFailed = vi.fn();
        vi.mocked(client.refreshAccountBalance).mockResolvedValueOnce(undefined);
        const failed = new TipForm(client, icp.ledger, { onRefreshFailed });
        await vi.waitFor(() => expect(failed.tokenChanging).toBe(false));
        expect(onRefreshFailed).toHaveBeenCalledWith(
            expect.objectContaining({
                key: "unableToRefreshAccountBalance",
                params: { token: "ICP" },
            }),
        );

        onRefreshFailed.mockClear();
        const refreshed = new TipForm(client, icp.ledger, { onRefreshFailed });
        await vi.waitFor(() => expect(refreshed.tokenChanging).toBe(false));
        expect(onRefreshFailed).not.toHaveBeenCalled();
    });

    test("a custom amount is exactly what was typed, in the token's units", () => {
        cryptoBalanceStore.setBalance(icp.ledger, 100_000_000n);
        const form = new TipForm(client, icp.ledger);

        expect(form.typeAmount("0.05")).toBeUndefined();
        expect(form.tokenState.draftAmount).toBe(5_000_000n);

        form.typeAmount("not a number");
        expect(form.tokenState.draftAmount).toBe(0n);
    });

    test("a custom amount with more decimals than the token has is cut to them", () => {
        const form = new TipForm(client, ckusdc.ledger);

        expect(form.typeAmount("0.1234567")).toBe("0.123456");
        expect(form.tokenState.draftAmount).toBe(123_456n);
    });

    // Invariant: a tip the OpenChat account can't cover, fees included, is said so and can't be sent
    test("an amount over the balance, fees included, is insufficient and not valid", async () => {
        cryptoBalanceStore.setBalance(icp.ledger, 1_000_000n);
        const form = new TipForm(client, icp.ledger);
        await vi.waitFor(() => expect(form.tokenChanging).toBe(false));

        form.typeAmount("0.0098");
        expect(form.insufficient).toBe(false);
        expect(form.valid).toBe(true);

        // 0.0099 + 0.0001 fee + 0.0001 approval fee > 0.01
        form.typeAmount("0.0099");
        expect(form.insufficient).toBe(true);
        expect(form.valid).toBe(false);
    });

    test("no amount yet is neither insufficient nor valid", async () => {
        const form = new TipForm(client, icp.ledger);
        await vi.waitFor(() => expect(form.tokenChanging).toBe(false));

        expect(form.insufficient).toBe(false);
        expect(form.valid).toBe(false);
    });

    test("refreshing checks the chosen token's balance again", async () => {
        const form = new TipForm(client, icp.ledger);
        await vi.waitFor(() => expect(form.tokenChanging).toBe(false));
        vi.mocked(client.refreshAccountBalance).mockClear();

        await form.refreshBalance();

        expect(client.refreshAccountBalance).toHaveBeenCalledWith(icp.ledger, false);
    });
});
