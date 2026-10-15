const ALCHEMY_API_KEY = import.meta.env.OC_ALCHEMY_API_KEY;

/**
 * The balance in lamports of the Solana account at `address`, as of the latest finalized block,
 * which is what the ckSOL minter reads before sweeping a deposit address
 */
export async function getSolBalance(address: string): Promise<bigint> {
    const response = await fetch(`https://solana-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getBalance",
            params: [address, { commitment: "finalized" }],
        }),
    });

    if (response.status !== 200) {
        const body = await response.text();
        throw new Error("Failed to fetch SOL balance: " + body);
    }
    const value: GetBalanceResponse = await response.json();
    if ("error" in value) {
        throw new Error("Failed to fetch SOL balance: " + value.error.message);
    }
    return BigInt(value.result.value);
}

type GetBalanceResponse =
    | { result: { context: { slot: number }; value: number } }
    | { error: { code: number; message: string } };
