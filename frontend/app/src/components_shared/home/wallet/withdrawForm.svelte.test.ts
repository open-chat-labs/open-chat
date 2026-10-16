import {
    anonymousUser,
    CKSOL_SYMBOL,
    currentUserStore,
    LEDGER_CANISTER_CKSOL,
    SOL_SYMBOL,
    type CksolMinterWithdrawalInfo,
    type EnhancedTokenDetails,
    type OpenChat,
} from "@client";
import { flushSync } from "svelte";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TokenState } from "./walletState.svelte";
import { WithdrawForm } from "./withdrawForm.svelte";

// ckSOL, as the Registry's ckSOL is shown in the app
const sol: EnhancedTokenDetails = {
    name: "Solana",
    symbol: SOL_SYMBOL,
    ledger: LEDGER_CANISTER_CKSOL,
    index: undefined,
    decimals: 9,
    transferFee: 500n,
    logo: "",
    infoUrl: "",
    transactionUrlFormat: "",
    supportedStandards: [],
    added: 0n,
    enabled: true,
    oneSecEnabled: false,
    evmContractAddresses: [],
    lastUpdated: 0n,
    balance: 0n,
    dollarBalance: undefined,
    icpBalance: undefined,
    btcBalance: undefined,
    ethBalance: undefined,
    zero: false,
    urlFormat: "",
};

const SOLANA_ADDRESS = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
const IC_ACCOUNT = "ryjl3-tyaaa-aaaaa-aaaba-cai";
const MINTER_INFO: CksolMinterWithdrawalInfo = {
    minWithdrawalAmount: 2_000_000n,
    withdrawalFee: 1_000_000n,
};

let resolveMinterInfo: (info: CksolMinterWithdrawalInfo) => void;

const client = {
    getCksolMinterWithdrawalInfo: vi.fn(
        () => new Promise<CksolMinterWithdrawalInfo>((resolve) => (resolveMinterInfo = resolve)),
    ),
    isAccountOfMultiUserCanisterUserId: vi.fn(() => false),
    formatTokens: (amount: bigint) => amount.toString(),
    OcIdentityPrincipal: "2vxsx-fae",
} as unknown as OpenChat;

let dispose: () => void;

function newForm(): WithdrawForm {
    let form!: WithdrawForm;
    dispose = $effect.root(() => {
        form = new WithdrawForm(client, new TokenState(sol));
    });
    flushSync();
    return form;
}

// Lets the effect which asked the minter for its info see the answer
async function minterAnswers(): Promise<void> {
    resolveMinterInfo(MINTER_INFO);
    await Promise.resolve();
    flushSync();
}

describe("withdrawing SOL", () => {
    beforeEach(() => {
        currentUserStore.set({ ...anonymousUser(), userId: "rdmx6-jaaaa-aaaaa-aaadq-cai" });
    });

    afterEach(() => {
        dispose();
        currentUserStore.set(anonymousUser());
        vi.clearAllMocks();
    });

    test("goes out to Solana through the ckSOL minter, unless the ckSOL network is chosen", () => {
        const form = newForm();

        expect(form.networks).toEqual([SOL_SYMBOL, CKSOL_SYMBOL]);
        expect(form.selectedNetwork).toBe(SOL_SYMBOL);
        expect(form.route).toEqual({ kind: "sol" });

        form.selectedNetwork = CKSOL_SYMBOL;
        expect(form.route).toEqual({ kind: "ledger" });
    });

    test("isn't offered for another token whose symbol is SOL", () => {
        let form!: WithdrawForm;
        dispose = $effect.root(() => {
            form = new WithdrawForm(
                client,
                new TokenState({ ...sol, ledger: "mxzaz-hqaaa-aaaar-qaada-cai" }),
            );
        });
        flushSync();

        expect(form.networks).toEqual([]);
        expect(form.route).toEqual({ kind: "ledger" });
    });

    test("needs a Solana address on the SOL network, and an IC account on the ckSOL network", () => {
        const form = newForm();

        form.targetAccount = SOLANA_ADDRESS;
        expect(form.targetAccountValid).toBe(true);
        form.targetAccount = IC_ACCOUNT;
        expect(form.targetAccountValid).toBe(false);

        form.selectedNetwork = CKSOL_SYMBOL;
        expect(form.targetAccountValid).toBe(true);
        form.targetAccount = SOLANA_ADDRESS;
        expect(form.targetAccountValid).toBe(false);
    });

    test("takes its minimum and fee from the ckSOL minter, the fee being exact", async () => {
        const form = newForm();
        expect(client.getCksolMinterWithdrawalInfo).toHaveBeenCalledTimes(1);
        expect(form.minAmount).toBe(0n);
        expect(form.networkFee).toBeUndefined();

        await minterAnswers();

        expect(form.minAmount).toBe(MINTER_INFO.minWithdrawalAmount);
        expect(form.networkFee).toBe(MINTER_INFO.withdrawalFee);
        expect(form.networkFeeIsEstimate).toBe(false);
        expect(form.networkFeeFormatted).toBe("1000000");
    });

    test("can't be sent until the ckSOL minter has said what its minimum is", async () => {
        const form = newForm();
        form.targetAccount = SOLANA_ADDRESS;
        form.validAmount = true;
        flushSync();
        expect(form.canSend).toBe(false);

        await minterAnswers();

        expect(form.canSend).toBe(true);
    });
});
