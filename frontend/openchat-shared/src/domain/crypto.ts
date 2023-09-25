export const E8S_PER_TOKEN = 100_000_000;

export const CHAT_SYMBOL = "CHAT";
export const ICP_SYMBOL = "ICP";
export const CKBTC_SYMBOL = "ckBTC";
export const SNS1_SYMBOL = "SNS1";
export const KINIC_SYMBOL = "KINIC";
export const HOTORNOT_SYMBOL = "HOT";
export const GHOST_SYMBOL = "GHOST";

export const LEDGER_CANISTER_ICP = "ryjl3-tyaaa-aaaaa-aaaba-cai";
export const LEDGER_CANISTER_CHAT = "2ouva-viaaa-aaaaq-aaamq-cai";

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

// approximate dollar exchange rates - until we come up with something better
const icpToDollar = 3;

export const dollarExchangeRates: Record<string, number> = {
    icp: icpToDollar,
    chat: 0.04805 * icpToDollar,
    hot: 0.003 * icpToDollar,
    kinic: 0.378 * icpToDollar,
    ckbtc: 7777.004 * icpToDollar,
    dkp: 280 * icpToDollar,
    ghost: 0.00001685 * icpToDollar,
    mod: 0.0065 * icpToDollar,
    cat: 0.0068998 * icpToDollar,
    boom: 0.00339 * icpToDollar,
    icx: 0.0000001 * icpToDollar,
};
