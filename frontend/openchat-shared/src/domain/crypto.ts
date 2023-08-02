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
    symbol: string;
    name: string;
    transferFeesE8s: bigint;
    howToBuyUrl: string;
    disabled: boolean;
    rootCanister: string | undefined;
};

export const tokenByGovernanceCanisterLookup: Record<string, Cryptocurrency> = {
    "2jvtu-yqaaa-aaaaq-aaama-cai": CHAT_SYMBOL,
    "zqfso-syaaa-aaaaq-aaafq-cai": SNS1_SYMBOL,
    "rrkah-fqaaa-aaaaa-aaaaq-cai": ICP_SYMBOL,
    "74ncn-fqaaa-aaaaq-aaasa-cai": KINIC_SYMBOL,
    "6wcax-haaaa-aaaaq-aaava-cai": HOTORNOT_SYMBOL,
    "4l7o7-uiaaa-aaaaq-aaa2q-cai": GHOST_SYMBOL,
};

export const cryptoLookup: Record<string, CryptocurrencyDetails> = {
    [ICP_SYMBOL]: {
        symbol: ICP_SYMBOL,
        name: "InternetComputer",
        transferFeesE8s: BigInt(10_000),
        howToBuyUrl: "https://www.finder.com/uk/how-to-buy-internet-computer",
        disabled: false,
        rootCanister: "r7inp-6aaaa-aaaaa-aaabq-cai",
    },
    [SNS1_SYMBOL]: {
        symbol: SNS1_SYMBOL,
        name: "SNS-1",
        transferFeesE8s: BigInt(1_000),
        howToBuyUrl: "https://3ezrj-4yaaa-aaaam-abcha-cai.ic0.app/sns/faq#how-can-i-get-sns-tokens",
        disabled: false,
        rootCanister: "zxeu2-7aaaa-aaaaq-aaafa-cai",
    },
    [CKBTC_SYMBOL]: {
        symbol: CKBTC_SYMBOL,
        name: "Chain-key Bitcoin",
        transferFeesE8s: BigInt(10),
        howToBuyUrl: "https://www.finder.com/uk/how-to-buy-bitcoin",
        disabled: false,
        rootCanister: undefined,
    },
    [CHAT_SYMBOL]: {
        symbol: CHAT_SYMBOL,
        name: "OpenChat",
        transferFeesE8s: BigInt(100_000),
        howToBuyUrl: "https://oc.app?faq=buychat",
        disabled: false,
        rootCanister: "3e3x2-xyaaa-aaaaq-aaalq-cai",
    },
    [KINIC_SYMBOL]: {
        symbol: KINIC_SYMBOL,
        name: "Kinic",
        transferFeesE8s: BigInt(100_000),
        howToBuyUrl: "https://3ezrj-4yaaa-aaaam-abcha-cai.ic0.app/sns/faq#how-can-i-get-sns-tokens",
        disabled: false,
        rootCanister: "7jkta-eyaaa-aaaaq-aaarq-cai",
    },
    [HOTORNOT_SYMBOL]: {
        symbol: HOTORNOT_SYMBOL,
        name: "HotOrNot",
        transferFeesE8s: BigInt(100_000),
        howToBuyUrl: "https://3ezrj-4yaaa-aaaam-abcha-cai.ic0.app/sns/faq#how-can-i-get-sns-tokens",
        disabled: true,
        rootCanister: "67bll-riaaa-aaaaq-aaauq-cai",
    },
    [GHOST_SYMBOL]: {
        symbol: GHOST_SYMBOL,
        name: "Ghost",
        transferFeesE8s: BigInt(100_000_000),
        howToBuyUrl: "https://3ezrj-4yaaa-aaaam-abcha-cai.ic0.app/sns/faq#how-can-i-get-sns-tokens",
        disabled: true,
        rootCanister: "4m6il-zqaaa-aaaaq-aaa2a-cai",
    },
};

export type Tokens = {
    e8s: bigint;
};
