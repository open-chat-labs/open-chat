import {
    BTC_SYMBOL,
    CKBTC_SYMBOL,
    LEDGER_CANISTER_CKSOL,
    SOL_SYMBOL,
    type OneSecTransferFees,
} from "@client";
import { flushSync, tick } from "svelte";
import { describe, expect, test, vi } from "vitest";
import { ReceiveAccount, type ReceiveToken } from "./receiveAccount.svelte";
import { userWalletAddress } from "./receiveAddress";

const owner = {
    cryptoAccount: "icp-account-identifier",
    userId: "qp43m-xeaaa-aaaaa-qaama-daa",
    principal: () => "2vxsx-fae",
};

const token = (over: Partial<ReceiveToken> = {}): ReceiveToken => ({
    ledger: "chat-ledger",
    symbol: "CHAT",
    decimals: 8,
    oneSecEnabled: false,
    evmContractAddresses: [],
    ...over,
});

function client() {
    return {
        getBtcAddress: vi.fn(async () => "bc1-address"),
        getSolAddress: vi.fn(async () => "sol-address"),
        getOneSecAddress: vi.fn(async () => "0x-address"),
        getCkbtcMinterDepositInfo: vi.fn(async () => ({ depositFee: 1_000n })),
        getCksolMinterDepositInfo: vi.fn(async () => ({ minimumDepositAmount: 10_000_000n })),
        oneSecGetTransferFees: vi.fn(async (): Promise<OneSecTransferFees[]> => []),
        oneSecGetNetworks: vi.fn(() => ["ICP", "Ethereum", "Base"]),
        formatTokens: vi.fn((amount: bigint) => String(amount)),
    };
}

// builds the account inside an effect root, as a component would, and lets its effects run
async function receive(t: ReceiveToken, c = client()) {
    let account!: ReceiveAccount;
    const stop = $effect.root(() => {
        account = new ReceiveAccount(
            c as never,
            () => t,
            () => owner,
        );
    });
    flushSync();
    await tick();
    flushSync();
    return { account, c, stop };
}

describe("where a token is received", () => {
    test("invariant 6: ICP at the ICP account, every other IC token at the wallet's ICRC account, never the bare user id", async () => {
        const icp = await receive(token({ symbol: "ICP", ledger: "icp-ledger" }));
        expect(icp.account.address).toBe("icp-account-identifier");
        const chat = await receive(token());
        expect(chat.account.address).toBe(userWalletAddress(owner.userId, owner.principal));
        expect(chat.account.address).not.toBe(owner.userId);
        expect(chat.account.networks).toEqual([]);
        icp.stop();
        chat.stop();
    });

    test("BTC: Bitcoin first, its address fetched; ckBTC at the wallet's account", async () => {
        const { account, c, stop } = await receive(token({ symbol: BTC_SYMBOL, ledger: "ckbtc" }));
        expect(account.networks).toEqual([BTC_SYMBOL, CKBTC_SYMBOL]);
        expect(account.selectedNetwork).toBe(BTC_SYMBOL);
        expect(account.address).toBe("bc1-address");
        expect(account.depositNote).toEqual({ kind: "btc", fee: "~1000" });
        account.selectedNetwork = CKBTC_SYMBOL;
        flushSync();
        expect(account.address).toBe(userWalletAddress(owner.userId, owner.principal));
        expect(c.getBtcAddress).toHaveBeenCalledTimes(1);
        stop();
    });

    test("SOL: the minimum and the deposit fees on the SOL network", async () => {
        const { account, stop } = await receive(
            token({ symbol: "SOL", ledger: LEDGER_CANISTER_CKSOL, decimals: 9 }),
        );
        expect(account.selectedNetwork).toBe(SOL_SYMBOL);
        expect(account.address).toBe("sol-address");
        expect(account.depositNote).toMatchObject({ kind: "sol", minimum: "10000000" });
        stop();
    });

    test("an address that can't be fetched fails, and the chosen network goes back to the first when it's no longer offered", async () => {
        const c = client();
        c.getBtcAddress.mockRejectedValueOnce(new Error("minter down"));
        vi.spyOn(console, "warn").mockImplementation(() => {});
        const { account, stop } = await receive(token({ symbol: BTC_SYMBOL, ledger: "ckbtc" }), c);
        expect(account.address).toBeUndefined();
        expect(account.failed).toBe(true);
        account.selectedNetwork = "Arbitrum";
        expect(account.selectedNetwork).toBe(BTC_SYMBOL);
        stop();
    });

    test("oneSec: its chains, the address fetched off ICP, and the fee as a share plus a transfer fee", async () => {
        const c = client();
        c.oneSecGetTransferFees.mockResolvedValue([
            {
                sourceToken: "USDC",
                destinationToken: "USDC",
                sourceChain: "Ethereum",
                destinationChain: "ICP",
                protocolFeePercent: 0.1,
                latestTransferFee: 0n,
                minAmount: 0n,
            },
            {
                sourceToken: "USDC",
                destinationToken: "USDC",
                sourceChain: "ICP",
                destinationChain: "Ethereum",
                protocolFeePercent: 0.1,
                latestTransferFee: 500n,
                minAmount: 0n,
            },
        ] as OneSecTransferFees[]);
        const { account, stop } = await receive(
            token({
                symbol: "USDC",
                oneSecEnabled: true,
                evmContractAddresses: [
                    { token: "USDC", chain: "Ethereum", address: "0x" },
                ] as ReceiveToken["evmContractAddresses"],
            }),
            c,
        );
        expect(account.networks).toEqual(["ICP", "Ethereum", "Base"]);
        expect(account.address).toBe(userWalletAddress(owner.userId, owner.principal));
        account.selectedNetwork = "Ethereum";
        flushSync();
        await tick();
        flushSync();
        expect(account.address).toBe("0x-address");
        expect(account.depositNote).toEqual({ kind: "one_sec", fee: "0.1% + ~500" });
        stop();
    });
});
