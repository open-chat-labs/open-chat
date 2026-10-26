import {
    anonymousUser,
    BTC_SYMBOL,
    CKBTC_SYMBOL,
    CKSOL_SYMBOL,
    currentUserStore,
    ETHEREUM_NETWORK,
    ICP_SYMBOL,
    LEDGER_CANISTER_CKSOL,
    LEDGER_CANISTER_ICP,
    SOL_SYMBOL,
    type CksolMinterWithdrawalInfo,
    type EnhancedTokenDetails,
    type OpenChat,
} from "@client";
import { AccountIdentifier } from "@icp-sdk/canisters/ledger/icp";
import { Principal } from "@icp-sdk/core/principal";
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

// ckBTC
const btc: EnhancedTokenDetails = {
    ...sol,
    name: "Bitcoin",
    symbol: BTC_SYMBOL,
    ledger: "mxzaz-hqaaa-aaaar-qaada-cai",
    decimals: 8,
};

// ICP
const icp: EnhancedTokenDetails = {
    ...sol,
    name: "Internet Computer",
    symbol: ICP_SYMBOL,
    ledger: LEDGER_CANISTER_ICP,
    decimals: 8,
};

const SOLANA_ADDRESS = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
const BITCOIN_ADDRESS = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq";
const EVM_ADDRESS = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";
const IC_ACCOUNT = "ryjl3-tyaaa-aaaaa-aaaba-cai";
const ICP_ACCOUNT_IDENTIFIER = AccountIdentifier.fromPrincipal({
    principal: Principal.anonymous(),
}).toHex();
const USER_ID = "rdmx6-jaaaa-aaaaa-aaadq-cai";
const OWN_ICP_ACCOUNT_IDENTIFIER = AccountIdentifier.fromPrincipal({
    principal: Principal.fromText(USER_ID),
}).toHex();

// USDT, with a OneSec route to Ethereum
const usdt: EnhancedTokenDetails = {
    ...sol,
    name: "Tether",
    symbol: "USDT",
    ledger: "cngnf-vqaaa-aaaar-qag4q-cai",
    decimals: 6,
    oneSecEnabled: true,
    evmContractAddresses: [{ token: "USDT", chain: ETHEREUM_NETWORK, address: EVM_ADDRESS }],
};
const MINTER_INFO: CksolMinterWithdrawalInfo = {
    minWithdrawalAmount: 2_000_000n,
    withdrawalFee: 1_000_000n,
};

let resolveMinterInfo: (info: CksolMinterWithdrawalInfo) => void;

const client = {
    getCksolMinterWithdrawalInfo: vi.fn(
        () => new Promise<CksolMinterWithdrawalInfo>((resolve) => (resolveMinterInfo = resolve)),
    ),
    // Never answers: these tests don't need the ckBTC minter's info
    getCkbtcMinterWithdrawalInfo: vi.fn(() => new Promise(() => {})),
    oneSecGetNetworks: vi.fn(() => [ICP_SYMBOL, ETHEREUM_NETWORK]),
    oneSecGetTransferFees: vi.fn(() => Promise.resolve([])),
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

    test("offers saved Solana addresses on the SOL network, and saved IC accounts on ckSOL", () => {
        const form = newForm();

        expect(form.acceptsAddress(SOLANA_ADDRESS)).toBe(true);
        expect(form.acceptsAddress(IC_ACCOUNT)).toBe(false);

        form.selectedNetwork = CKSOL_SYMBOL;
        expect(form.acceptsAddress(IC_ACCOUNT)).toBe(true);
        for (const other of [
            SOLANA_ADDRESS,
            BITCOIN_ADDRESS,
            EVM_ADDRESS,
            ICP_ACCOUNT_IDENTIFIER,
        ]) {
            expect(form.acceptsAddress(other), other).toBe(false);
        }
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

describe("withdrawing BTC", () => {
    beforeEach(() => {
        currentUserStore.set({ ...anonymousUser(), userId: "rdmx6-jaaaa-aaaaa-aaadq-cai" });
    });

    afterEach(() => {
        dispose();
        currentUserStore.set(anonymousUser());
        vi.clearAllMocks();
    });

    test("needs a Bitcoin address on the BTC network, and an IC account on the ckBTC network", () => {
        let form!: WithdrawForm;
        dispose = $effect.root(() => {
            form = new WithdrawForm(client, new TokenState(btc));
        });
        flushSync();
        expect(form.networks).toEqual([BTC_SYMBOL, CKBTC_SYMBOL]);

        form.targetAccount = BITCOIN_ADDRESS;
        expect(form.targetAccountValid).toBe(true);
        // An address on another network can still be typed, pasted or scanned
        form.targetAccount = SOLANA_ADDRESS;
        expect(form.targetAccountValid).toBe(false);
        form.targetAccount = IC_ACCOUNT;
        expect(form.targetAccountValid).toBe(false);

        form.selectedNetwork = CKBTC_SYMBOL;
        expect(form.targetAccountValid).toBe(true);
        form.targetAccount = BITCOIN_ADDRESS;
        expect(form.targetAccountValid).toBe(false);
    });
});

describe("withdrawing ICP", () => {
    beforeEach(() => {
        currentUserStore.set({ ...anonymousUser(), userId: "rdmx6-jaaaa-aaaaa-aaadq-cai" });
    });

    afterEach(() => {
        dispose();
        currentUserStore.set(anonymousUser());
        vi.clearAllMocks();
    });

    test("goes to an IC account or an ICP account identifier", () => {
        let form!: WithdrawForm;
        dispose = $effect.root(() => {
            form = new WithdrawForm(client, new TokenState(icp));
        });
        flushSync();
        expect(form.networks).toEqual([]);

        for (const address of [IC_ACCOUNT, ICP_ACCOUNT_IDENTIFIER]) {
            expect(form.acceptsAddress(address), address).toBe(true);
            form.targetAccount = address;
            expect(form.targetAccountValid, address).toBe(true);
        }
        for (const other of [SOLANA_ADDRESS, BITCOIN_ADDRESS, EVM_ADDRESS]) {
            expect(form.acceptsAddress(other), other).toBe(false);
            form.targetAccount = other;
            expect(form.targetAccountValid, other).toBe(false);
        }
    });

    test("refuses the user's own wallet and a user id's account, saved or typed", () => {
        currentUserStore.set({
            ...anonymousUser(),
            userId: USER_ID,
            cryptoAccount: OWN_ICP_ACCOUNT_IDENTIFIER,
        });
        let form!: WithdrawForm;
        dispose = $effect.root(() => {
            form = new WithdrawForm(client, new TokenState(icp));
        });
        flushSync();

        expect(form.acceptsAddress(OWN_ICP_ACCOUNT_IDENTIFIER)).toBe(false);
        form.targetAccount = OWN_ICP_ACCOUNT_IDENTIFIER;
        expect(form.targetAccountValid).toBe(false);

        vi.mocked(client.isAccountOfMultiUserCanisterUserId).mockReturnValueOnce(true);
        expect(form.acceptsAddress(IC_ACCOUNT)).toBe(false);
        expect(form.acceptsAddress(IC_ACCOUNT)).toBe(true);
    });
});

describe("withdrawing USDT", () => {
    beforeEach(() => {
        currentUserStore.set({ ...anonymousUser(), userId: USER_ID });
    });

    afterEach(() => {
        dispose();
        currentUserStore.set(anonymousUser());
        vi.clearAllMocks();
    });

    test("offers saved IC accounts on the ICP network, and saved EVM addresses on Ethereum", () => {
        let form!: WithdrawForm;
        dispose = $effect.root(() => {
            form = new WithdrawForm(client, new TokenState(usdt));
        });
        flushSync();
        expect(form.networks).toEqual([ICP_SYMBOL, ETHEREUM_NETWORK]);
        expect(form.route).toEqual({ kind: "ledger" });

        expect(form.acceptsAddress(IC_ACCOUNT)).toBe(true);
        expect(form.acceptsAddress(EVM_ADDRESS)).toBe(false);
        // Only an account on the ICP ledger
        expect(form.acceptsAddress(ICP_ACCOUNT_IDENTIFIER)).toBe(false);

        form.selectedNetwork = ETHEREUM_NETWORK;
        flushSync();
        expect(form.route).toEqual({ kind: "one_sec", chain: ETHEREUM_NETWORK });
        expect(form.acceptsAddress(EVM_ADDRESS)).toBe(true);
        for (const other of [IC_ACCOUNT, ICP_ACCOUNT_IDENTIFIER, BITCOIN_ADDRESS, SOLANA_ADDRESS]) {
            expect(form.acceptsAddress(other), other).toBe(false);
        }
    });
});
