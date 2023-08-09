export const E8S_PER_TOKEN = 100_000_000;

export const ICP_TRANSFER_FEE_E8S = BigInt(10_000);

export const CHAT_SYMBOL = "CHAT";
export const ICP_SYMBOL = "ICP";
export const CKBTC_SYMBOL = "ckBTC";
export const SNS1_SYMBOL = "SNS1";
export const KINIC_SYMBOL = "KINIC";
export const HOTORNOT_SYMBOL = "HOT";
export const GHOST_SYMBOL = "GHOST";

export const cryptoCurrencyList = [
    CHAT_SYMBOL,
    ICP_SYMBOL,
    CKBTC_SYMBOL,
    SNS1_SYMBOL,
    KINIC_SYMBOL,
    HOTORNOT_SYMBOL,
    GHOST_SYMBOL,
] as const;

type CryptocurrenciesType = typeof cryptoCurrencyList;
export type Cryptocurrency = CryptocurrenciesType[number];

export type CryptocurrencyDetails = {
    name: string;
    symbol: string;
    ledger: string;
    decimals: number;
    transferFee: bigint;
    logo: string;
    howToBuyUrl: string;
    infoUrl: string;
    transactionUrlFormat: string;
    governanceCanister: string | undefined;
    rootCanister: string | undefined;
    lastUpdated: bigint;
};
