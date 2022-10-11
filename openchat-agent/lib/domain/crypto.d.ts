export declare const E8S_PER_TOKEN = 100000000;
export declare const ICP_TRANSFER_FEE_E8S: bigint;
export declare const cryptoCurrencyList: readonly ["icp", "btc", "chat"];
declare type CryptocurrenciesType = typeof cryptoCurrencyList;
export declare type Cryptocurrency = CryptocurrenciesType[number];
export declare type CryptocurrencyDetails = {
    symbol: string;
    name: string;
    transferFeesE8s: bigint;
    howToBuyUrl: string;
};
export declare const cryptoLookup: Record<Cryptocurrency, CryptocurrencyDetails>;
export declare type Tokens = {
    e8s: bigint;
};
export {};
