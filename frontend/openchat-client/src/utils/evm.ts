import {
    ARBITRUM_NETWORK,
    BASE_NETWORK,
    ETHEREUM_NETWORK,
    type EvmChain,
    type EvmContractAddress,
} from "openchat-shared";

const ALCHEMY_API_KEY = import.meta.env.OC_ALCHEMY_API_KEY;
const NETWORKS_MAP = new Map<string, EvmChain>([
    ["eth-mainnet", ETHEREUM_NETWORK],
    ["arb-mainnet", ARBITRUM_NETWORK],
    ["base-mainnet", BASE_NETWORK],
]);

export async function getErc20TokenBalances(
    address: string,
    contractAddresses: EvmContractAddress[],
): Promise<Erc20TokenBalance[]> {
    if (contractAddresses.length === 0) return [];

    const url = `https://api.g.alchemy.com/data/v1/${ALCHEMY_API_KEY}/assets/tokens/balances/by-address`;

    const requestOptions = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            addresses: [
                {
                    address,
                    networks: [...NETWORKS_MAP.keys()],
                },
            ],
            includeNativeTokens: false,
        }),
    };

    const response = await fetch(url, requestOptions);

    if (response.status !== 200) {
        const body = await response.text();
        throw new Error("Failed to fetch Erc20TokenBalances: " + body);
    }
    const value: TokenBalancesByAddressResponse = await response.json();

    return value.data.tokens.reduce((res, next) => {
        const mapped = mapTokenBalance(next, contractAddresses);
        if (mapped !== undefined) {
            res.push(mapped);
        }
        return res;
    }, [] as Erc20TokenBalance[]);
}

// Return the non-zero balances of tokens contained in the `contractAddresses` array, any other
// tokens can be ignored
function mapTokenBalance(
    value: TokenBalanceResponse,
    contractAddresses: EvmContractAddress[],
): Erc20TokenBalance | undefined {
    const balance = BigInt(value.tokenBalance);
    if (balance === 0n) return undefined;
    const chain = NETWORKS_MAP.get(value.network);
    if (chain === undefined) return undefined;
    const tokenAddress = value.tokenAddress.toLowerCase();
    const token = contractAddresses.find((c) => c.chain === chain && c.address === tokenAddress)
        ?.token;
    if (token === undefined) return undefined;
    return {
        chain,
        token,
        balance,
    };
}

export type Erc20TokenBalance = {
    chain: EvmChain;
    token: string;
    balance: bigint;
};

type TokenBalancesByAddressResponse = {
    data: {
        tokens: TokenBalanceResponse[];
        pageKey: string | null;
    };
};

type TokenBalanceResponse = {
    network: string;
    address: string;
    tokenAddress: string;
    tokenBalance: string;
};
