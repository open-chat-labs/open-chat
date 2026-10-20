import { AnonymousIdentity, type HttpAgent, type Identity } from "@icp-sdk/core/agent";
import type { DexId, DexQuoteResult, TokenSwapPool } from "@shared";
import { IcpSwapIndexClient } from "./icpSwap/index/icpSwap.index.client";
import { TacoIndexClient } from "./taco/index/taco.index.client";

const TEN_MINUTES = 10 * 60 * 1000;

// A DEX's pools, along with the tokens it will swap straight from the wallet, which is any of them
// if `walletInputTokens` is undefined
type DexPools = { pools: TokenSwapPool[]; walletInputTokens: Set<string> | undefined };

export class DexesAgent {
    private _identity: Identity;
    private _swapIndexClients: Record<DexId, SwapIndexClient>;
    private _poolsCache: Record<string, [DexPools, number]> = {};

    constructor(private agent: HttpAgent) {
        this._identity = new AnonymousIdentity();
        this._swapIndexClients = {
            icpswap: new IcpSwapIndexClient(this._identity, this.agent),
            taco: new TacoIndexClient(this._identity, this.agent),
        };
    }

    // The pools which will swap `inputToken` straight from the wallet for any of `outputTokens`
    async getSwapPools(
        inputToken: string,
        outputTokens: Set<string>,
        swapProviders: DexId[],
    ): Promise<TokenSwapPool[]> {
        const allPools = await this.getAllSwapPools(swapProviders);

        return allPools.flatMap((dexPools) => walletSwapPools(dexPools, inputToken, outputTokens));
    }

    // Which of `tokens` can be swapped straight from the wallet for another of them
    async canSwap(tokens: Set<string>, swapProviders: DexId[]): Promise<Set<string>> {
        const allPools = await this.getAllSwapPools(swapProviders);

        const available = new Set<string>();

        for (const dexPools of allPools) {
            for (const p of dexPools.pools) {
                if (tokens.has(p.token0) && tokens.has(p.token1)) {
                    for (const token of [p.token0, p.token1]) {
                        if (swapsFromWallet(dexPools, token)) {
                            available.add(token);
                        }
                    }
                }
            }
        }

        return available;
    }

    // What `dex` quotes for swapping `amountIn` of `inputToken` straight from the wallet for
    // `outputToken`. Rejects when the DEX fails to answer.
    async quoteSwap(
        dex: DexId,
        inputToken: string,
        outputToken: string,
        amountIn: bigint,
        outputTokenFee: bigint,
    ): Promise<DexQuoteResult> {
        const pools = walletSwapPools(
            await this.getDexPools(dex),
            inputToken,
            new Set([outputToken]),
        );
        if (pools.length === 0) {
            return { kind: "unsupported" };
        }

        // A pool that cannot quote is a normal answer, not a failure: the commonest case is an
        // amount too small for that pool's fee, and pools also go dry or get retired. A pool that
        // declines resolves to undefined, while one that fails rejects. With no quote in hand, a
        // failure is what stopped the user getting one, so it surfaces rather than reading as a
        // decline.
        const quotes = await Promise.allSettled(
            pools.map((p) =>
                this.quoteSingle(p, inputToken, outputToken, amountIn, outputTokenFee),
            ),
        );
        const best = quotes.reduce<bigint | undefined>(
            (best, q) =>
                q.status === "fulfilled" &&
                q.value !== undefined &&
                (best === undefined || q.value > best)
                    ? q.value
                    : best,
            undefined,
        );
        const failed = quotes.find((q): q is PromiseRejectedResult => q.status === "rejected");
        if (best === undefined) {
            if (failed !== undefined) throw failed.reason;
            return { kind: "declined" };
        }
        if (failed !== undefined) {
            console.warn(`quoteSwap: a ${dex} pool failed, quoting without it`, failed.reason);
        }
        return { kind: "quoted", amountOut: best };
    }

    // The pools of each of `swapProviders`, leaving out any DEX which fails to list them
    private getAllSwapPools(swapProviders: DexId[]): Promise<DexPools[]> {
        return Promise.allSettled(swapProviders.map((dex) => this.getDexPools(dex))).then(
            (result) => result.flatMap((r) => (r.status === "fulfilled" ? [r.value] : [])),
        );
    }

    // `dex`'s pools, cached for ten minutes
    private async getDexPools(dex: DexId): Promise<DexPools> {
        const cached = this.tryGetAllSwapPoolsFromCache(dex);
        if (cached !== undefined) {
            return cached;
        }
        const client = this._swapIndexClients[dex];
        if (client === undefined) {
            return { pools: [], walletInputTokens: undefined };
        }
        const [pools, walletInputTokens] = await Promise.all([
            client.getPools(),
            client.walletInputTokens(),
        ]);
        const dexPools = { pools, walletInputTokens };
        this._poolsCache[dex] = [dexPools, Date.now()];
        return dexPools;
    }

    private quoteSingle(
        pool: TokenSwapPool,
        inputToken: string,
        outputToken: string,
        amountIn: bigint,
        outputTokenFee: bigint,
    ): Promise<bigint | undefined> {
        const indexClient = this._swapIndexClients[pool.dex];
        if (indexClient === undefined) {
            return Promise.resolve(BigInt(0));
        }
        const poolClient = indexClient.getPoolClient(pool.canisterId, pool.token0, pool.token1);
        return poolClient.quote(inputToken, outputToken, amountIn, outputTokenFee);
    }

    private tryGetAllSwapPoolsFromCache(dex: DexId): DexPools | undefined {
        const cached = this._poolsCache[dex];
        if (cached === undefined) {
            return undefined;
        }
        const [pools, timestamp] = cached;
        const now = Date.now();
        return now - timestamp < TEN_MINUTES ? pools : undefined;
    }
}

function swapsFromWallet({ walletInputTokens }: DexPools, inputToken: string): boolean {
    return walletInputTokens?.has(inputToken) ?? true;
}

// A DEX's pools which will swap `inputToken` straight from the wallet for any of `outputTokens`
function walletSwapPools(
    dexPools: DexPools,
    inputToken: string,
    outputTokens: Set<string>,
): TokenSwapPool[] {
    if (!swapsFromWallet(dexPools, inputToken)) return [];
    return dexPools.pools.filter(
        (p) =>
            (p.token0 === inputToken && outputTokens.has(p.token1)) ||
            (p.token1 === inputToken && outputTokens.has(p.token0)),
    );
}

export interface SwapIndexClient {
    getPoolClient(canisterId: string, token0: string, token1: string): SwapPoolClient;
    getPools(): Promise<TokenSwapPool[]>;
    // The tokens the DEX will swap straight from the wallet, or undefined if any
    walletInputTokens(): Promise<Set<string> | undefined>;
}

export interface SwapPoolClient {
    // What reaches the wallet from swapping `amountIn`, which is what the DEX pulls from the wallet,
    // after every fee, including `outputTokenFee` for sending the output to the wallet. undefined
    // when the pool declines to quote (amount too small, no liquidity); reject only for a failure to
    // ask
    quote(
        inputToken: string,
        outputToken: string,
        amountIn: bigint,
        outputTokenFee: bigint,
    ): Promise<bigint | undefined>;
}
