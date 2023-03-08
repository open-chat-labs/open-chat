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
    diamond: boolean;
    nsRootCanister: string | undefined;
};

export const tokenByGovernanceCanisterLookup: Record<string, Cryptocurrency> = {
    "2jvtu-yqaaa-aaaaq-aaama-cai": "chat",
    "zqfso-syaaa-aaaaq-aaafq-cai": "sns1",
    "rrkah-fqaaa-aaaaa-aaaaq-cai": "icp"
}

export const cryptoLookup: Record<Cryptocurrency, CryptocurrencyDetails> = {
    icp: {
        symbol: "ICP",
        name: "InternetComputer",
        transferFeesE8s: BigInt(10_000),
        howToBuyUrl: "https://www.finder.com/uk/how-to-buy-internet-computer",
        disabled: false,
        diamond: false,
        nsRootCanister: "r7inp-6aaaa-aaaaa-aaabq-cai"
    },
    sns1: {
        symbol: "SNS1",
        name: "SNS-1",
        transferFeesE8s: BigInt(1_000),
        howToBuyUrl:
            "https://3ezrj-4yaaa-aaaam-abcha-cai.ic0.app/sns/faq#how-do-you-get-sns-tokens",
        disabled: false,
        diamond: true,
        nsRootCanister: "zxeu2-7aaaa-aaaaq-aaafa-cai"
    },
    ckbtc: {
        symbol: "ckBTC",
        name: "Chain-key Bitcoin",
        transferFeesE8s: BigInt(10),
        howToBuyUrl: "https://www.finder.com/uk/how-to-buy-bitcoin",
        disabled: false,
        diamond: true,
        nsRootCanister: undefined
    },
    chat: {
        symbol: "CHAT",
        name: "OpenChat",
        transferFeesE8s: BigInt(100_000),
        howToBuyUrl: "https://oc.app?faq=chat_account",
        disabled: false,
        diamond: false,
        nsRootCanister: "3e3x2-xyaaa-aaaaq-aaalq-cai"
    },
};

export type Tokens = {
    e8s: bigint;
};
