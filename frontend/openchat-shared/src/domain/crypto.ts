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
const dollarToICP = 0.34;

export const dollarExchangeRates: Record<string, number> = {
    icp: dollarToICP,
    chat: 7, // dollarToICP / 0.04805,
    hot: 113, // dollarToICP / 0.003,
    kinic: 0.9, // dollarToICP / 0.378,
    ckbtc: 0.000044, // dollarToICP / 7777.004,
    dkp: 0.0012, // dollarToICP / 280,
    ghost: 20000, // dollarToICP / 0.00001685,
    mod: 52, // dollarToICP / 0.0065,
    cat: 49, // dollarToICP / 0.0068998,
    boom: 100, // dollarToICP / 0.00339,
    icx: 3400000, // dollarToICP / 0.0000001,
};
