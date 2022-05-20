export const E8S_PER_TOKEN = 100_000_000;

export const ICP_TRANSFER_FEE_E8S = BigInt(10_000);

export type Cryptocurrency = "icp" | "btc" | "chat";

export type CryptocurrencyDetails = {
    symbol: string;
    name: string;
    transferFeesE8s: bigint;
    howToBuyUrl: string;
};

export const cryptoLookup: Record<Cryptocurrency, CryptocurrencyDetails> = {
    icp: {
        symbol: "ICP",
        name: "InternetComputer",
        transferFeesE8s: BigInt(10_000),
        howToBuyUrl: "https://www.finder.com/uk/how-to-buy-internet-computer",
    },
    btc: {
        symbol: "BTC",
        name: "Bitcoin",
        transferFeesE8s: BigInt(10_000),
        howToBuyUrl: "https://www.finder.com/uk/how-to-buy-bitcoin",
    },
    chat: {
        symbol: "CHAT",
        name: "OpenChat",
        transferFeesE8s: BigInt(10_000),
        howToBuyUrl: "https://oc.app/#/?faq=chat_account",
    },
};

export type Tokens = {
    e8s: bigint;
};
