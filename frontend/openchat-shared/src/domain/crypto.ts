export const E8S_PER_TOKEN = 100_000_000;

export const ICP_TRANSFER_FEE_E8S = BigInt(10_000);

export const cryptoCurrencyList = ["icp", "sns1", "ckbtc", "chat"] as const;

type CryptocurrenciesType = typeof cryptoCurrencyList;
export type Cryptocurrency = CryptocurrenciesType[number];

export type CryptocurrencyDetails = {
    symbol: string;
    name: string;
    transferFeesE8s: bigint;
    howToBuyUrl: string;
    disabled: boolean;
};

export const cryptoLookup: Record<Cryptocurrency, CryptocurrencyDetails> = {
    icp: {
        symbol: "ICP",
        name: "InternetComputer",
        transferFeesE8s: BigInt(10_000),
        howToBuyUrl: "https://www.finder.com/uk/how-to-buy-internet-computer",
        disabled: false,
    },
    sns1: {
        symbol: "SNS1",
        name: "SNS-1",
        transferFeesE8s: BigInt(1_000),
        howToBuyUrl: "https://3ezrj-4yaaa-aaaam-abcha-cai.ic0.app/sns/faq#how-do-you-get-sns-tokens",
        disabled: false,
    },
    ckbtc: {
        symbol: "ckBTC",
        name: "Chain-key Bitcoin",
        transferFeesE8s: BigInt(10_000),
        howToBuyUrl: "https://www.finder.com/uk/how-to-buy-bitcoin",
        disabled: true,
    },
    chat: {
        symbol: "CHAT",
        name: "OpenChat",
        transferFeesE8s: BigInt(10_000),
        howToBuyUrl: "https://oc.app/#/?faq=chat_account",
        disabled: true,
    },
};

export type Tokens = {
    e8s: bigint;
};
