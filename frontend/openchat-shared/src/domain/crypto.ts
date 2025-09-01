import type { Failure, Success } from "./response";

export const E8S_PER_TOKEN = 100_000_000;

export const CHAT_SYMBOL = "CHAT";
export const ICP_SYMBOL = "ICP";
export const BTC_SYMBOL = "BTC";
export const CKBTC_SYMBOL = "ckBTC";
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

export const LEDGER_CANISTER_ICP = "ryjl3-tyaaa-aaaaa-aaaba-cai";
export const INDEX_CANISTER_ICP = "qhbym-qaaaa-aaaaa-aaafq-cai";
export const LEDGER_CANISTER_CHAT = "2ouva-viaaa-aaaaq-aaamq-cai";

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
