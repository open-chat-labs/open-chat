import type { ResourceKey } from "../utils/i18n";
import type { Failure, Success } from "./response";

export const E8S_PER_TOKEN = 100_000_000;

export const CHAT_SYMBOL = "CHAT";
export const ICP_SYMBOL = "ICP";
export const BTC_SYMBOL = "BTC";
export const CKBTC_SYMBOL = "ckBTC";
export const SOL_SYMBOL = "SOL";
export const CKSOL_SYMBOL = "ckSOL";
// What the user is charged for a SOL deposit, in lamports, being what they send less what they are
// credited with: more for their first, whose sweep leaves Solana's rent reserve on their address.
// They must match `FIRST_SOL_DEPOSIT_FEE` and `SOL_DEPOSIT_FEE` in the MultiUser canister.
export const FIRST_SOL_DEPOSIT_FEE = 2_000_000n;
export const SOL_DEPOSIT_FEE = 1_000_000n;
export const SNS1_SYMBOL = "SNS1";
export const KINIC_SYMBOL = "KINIC";
export const HOTORNOT_SYMBOL = "HOT";
export const GHOST_SYMBOL = "GHOST";
export const USDC_SYMBOL = "USDC";
export const USDT_SYMBOL = "USDT";

export const ETHEREUM_NETWORK = "Ethereum";
export const ARBITRUM_NETWORK = "Arbitrum";
export const BASE_NETWORK = "Base";

export const ONE_SEC_TOKENS = [USDC_SYMBOL, USDT_SYMBOL];
export type EvmChain = typeof ETHEREUM_NETWORK | typeof ARBITRUM_NETWORK | typeof BASE_NETWORK;
export type Chain = EvmChain | typeof ICP_SYMBOL;

/**
 * Where a withdrawal from the user's wallet goes: to an account on the token's own ledger, out to
 * Bitcoin through the ckBTC minter, or out to an EVM chain through OneSec
 */
export type WithdrawalRoute =
    | { kind: "ledger" }
    | { kind: "btc" }
    | { kind: "one_sec"; chain: EvmChain };

export type Withdrawal = {
    ledger: string;
    symbol: string;
    route: WithdrawalRoute;
    to: string;
    amount: bigint;
    // the ledger's fee for a single transfer, which a withdrawal on the token's own ledger pays
    fee: bigint;
};

/** How a withdrawal went. `cancelled` means the user dismissed the PIN prompt, so nothing was sent */
export type WithdrawOutcome =
    | { kind: "sent" }
    | { kind: "cancelled" }
    | { kind: "failed"; message: ResourceKey };

export const LEDGER_CANISTER_ICP = "ryjl3-tyaaa-aaaaa-aaaba-cai";
export const INDEX_CANISTER_ICP = "qhbym-qaaaa-aaaaa-aaafq-cai";
export const LEDGER_CANISTER_CHAT = "2ouva-viaaa-aaaaq-aaamq-cai";
export const LEDGER_CANISTER_CKBTC = "mxzaz-hqaaa-aaaar-qaada-cai";
export const LEDGER_CANISTER_CKETH = "ss2fx-dyaaa-aaaar-qacoq-cai";
export const LEDGER_CANISTER_CKSOL = "ls5lp-lqaaa-aaaar-qb5oa-cai";

export const DEFAULT_TOKENS = ["CHAT", "ICP", "BTC", "USDC", "USDT"];

export type CryptocurrencyDetails = {
    name: string;
    symbol: string;
    ledger: string;
    index: string | undefined;
    decimals: number;
    transferFee: bigint;
    logo: string;
    infoUrl: string;
    transactionUrlFormat: string;
    supportedStandards: string[];
    added: bigint;
    enabled: boolean;
    oneSecEnabled: boolean;
    evmContractAddresses: EvmContractAddress[];
    lastUpdated: bigint;
};

export type EnhancedTokenDetails = CryptocurrencyDetails & {
    balance: bigint;
    dollarBalance: number | undefined;
    icpBalance: number | undefined;
    btcBalance: number | undefined;
    ethBalance: number | undefined;
    zero: boolean;
    urlFormat: string;
};

export type NervousSystemSummary = {
    rootCanisterId: string;
    governanceCanisterId: string;
    ledgerCanisterId: string;
    indexCanisterId: string;
    isNns: boolean;
    proposalRejectionFee: bigint;
    submittingProposalsEnabled: boolean;
};

export type NervousSystemDetails = {
    governanceCanisterId: string;
    rootCanisterId: string;
    ledgerCanisterId: string;
    indexCanisterId: string;
    isNns: boolean;
    proposalRejectionFee: bigint;
    submittingProposalsEnabled: boolean;
    token: CryptocurrencyDetails;
};

type AccountTransactionCommon = {
    timestamp: Date;
    id: bigint;
    memo?: string;
    createdAt?: Date;
    amount: bigint;
    to?: string;
    from?: string;
};

type AccountTransactionBurn = AccountTransactionCommon & {
    kind: "burn";
    spender?: string;
};

type AccountTransactionMint = AccountTransactionCommon & {
    kind: "mint";
};

type AccountTransactionApprove = AccountTransactionCommon & {
    kind: "approve";
    fee?: bigint;
    expectedAllowance?: bigint;
    expiredAt?: bigint;
    spender?: string;
};

type AccountTransactionTransfer = AccountTransactionCommon & {
    kind: "transfer";
    fee?: bigint;
    spender?: string;
};

export type AccountTransaction =
    | AccountTransactionBurn
    | AccountTransactionMint
    | AccountTransactionTransfer
    | AccountTransactionApprove;

export type AccountTransactions = {
    transactions: AccountTransaction[];
    oldestTransactionId?: bigint;
};

export type AccountTransactionResult = Failure | (Success & AccountTransactions);

export type TokenExchangeRates = {
    toUSD: number | undefined;
};

export type WalletConfig = AutoWallet | ManualWallet;

export type AutoWallet = {
    kind: "auto_wallet";
    minDollarValue: number;
};

export type ManualWallet = {
    kind: "manual_wallet";
    tokens: Set<string>;
};

export type EvmContractAddress = {
    token: string;
    chain: EvmChain;
    address: string;
};
